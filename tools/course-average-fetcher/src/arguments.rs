use super::*;

#[derive(Debug, Parser)]
#[command(
  author,
  version,
  about = "Fetch course averages from the McGill Enhanced Google Sheet."
)]
pub(super) struct Arguments {
  #[arg(
    short,
    long,
    default_value_os_t = default_output_path(),
    hide_default_value = true,
    help = "Path to the output JSON file."
  )]
  output_path: PathBuf,
  #[arg(
    long,
    default_value_os_t = default_credentials_path(),
    hide_default_value = true,
    help = "Path to the Google OAuth client credentials file."
  )]
  credentials_path: PathBuf,
  #[arg(
    long,
    default_value_os_t = default_token_path(),
    hide_default_value = true,
    help = "Path to the OAuth token cache file."
  )]
  token_path: PathBuf,
  #[arg(
    long,
    help = "Path to a Google Sheets values JSON file to read instead of fetching."
  )]
  source_path: Option<PathBuf>,
}

impl Arguments {
  fn cell(
    row: &[Value],
    index: usize,
    row_number: usize,
    field: &str,
  ) -> Result<String> {
    row
      .get(index)
      .and_then(|value| match value {
        Value::Bool(value) => Some(value.to_string()),
        Value::Number(value) => Some(value.to_string()),
        Value::String(value) => Some(value.trim().to_string()),
        Value::Array(_) | Value::Object(_) | Value::Null => None,
      })
      .filter(|value| !value.is_empty())
      .with_context(|| format!("missing {field} in row {row_number}"))
  }

  fn parse_course_average(
    row: &[Value],
    row_number: usize,
  ) -> Result<CourseAverage> {
    let course_id = Self::cell(row, 1, row_number, "course ID")?;

    let term = Self::cell(row, 2, row_number, "term")?;

    let season = match term.as_bytes().first().map(u8::to_ascii_lowercase) {
      Some(b'w') => "Winter",
      Some(b'f') => "Fall",
      Some(b's') => "Summer",
      _ => bail!("incorrect term format: {term}"),
    };

    let year = term
      .get(1..)
      .filter(|year| year.len() == 4)
      .filter(|year| year.chars().all(|c| c.is_ascii_digit()))
      .with_context(|| format!("incorrect term format: {term}"))?;

    let average = Self::cell(row, 3, row_number, "average")?;

    Ok(CourseAverage {
      course_id,
      term: format!("{season} {year}"),
      average: serde_json::from_value::<Grade>(Value::String(average.clone()))
        .with_context(|| {
          format!("invalid average {average:?} in row {row_number}")
        })?,
    })
  }

  pub(super) async fn run(self) -> Result {
    let rows = if let Some(source_path) = &self.source_path {
      serde_json::from_str::<ValueRange>(&fs::read_to_string(source_path)?)
        .with_context(|| format!("failed to parse {}", source_path.display()))?
        .values
        .unwrap_or_default()
    } else {
      let secret = yup_oauth2::read_application_secret(&self.credentials_path)
        .await
        .with_context(|| {
          format!("failed to read {}", self.credentials_path.display())
        })?;

      let auth_connector = HttpsConnectorBuilder::new()
        .with_native_roots()
        .context("failed to load native TLS roots")?
        .https_only()
        .enable_http2()
        .build();

      let auth_client =
        Client::builder(TokioExecutor::new()).build(auth_connector);

      let auth = InstalledFlowAuthenticator::with_client(
        secret,
        InstalledFlowReturnMethod::HTTPRedirect,
        CustomHyperClientBuilder::from(auth_client),
      )
      .persist_tokens_to_disk(&self.token_path)
      .build()
      .await
      .with_context(|| {
        format!(
          "failed to initialize OAuth cache {}",
          self.token_path.display()
        )
      })?;

      let connector = HttpsConnectorBuilder::new()
        .with_native_roots()
        .context("failed to load native TLS roots")?
        .https_only()
        .enable_http2()
        .build();

      let client = Client::builder(TokioExecutor::new()).build(connector);

      let hub = Sheets::new(client, auth);

      let (_, value_range) = hub
        .spreadsheets()
        .values_get(SPREADSHEET_ID, RANGE_NAME)
        .add_scope(SCOPE)
        .doit()
        .await
        .context("failed to fetch course averages")?;

      value_range.values.unwrap_or_default()
    };

    if rows.is_empty() {
      println!("No data found.");
      return Ok(());
    }

    let course_averages = rows
      .into_iter()
      .enumerate()
      .map(|(index, row)| Self::parse_course_average(&row, index + 3))
      .collect::<Result<Vec<CourseAverage>>>()?;

    if let Some(parent) = self
      .output_path
      .parent()
      .filter(|parent| !parent.as_os_str().is_empty())
    {
      fs::create_dir_all(parent)
        .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    fs::write(
      &self.output_path,
      serde_json::to_string_pretty(&course_averages)?,
    )
    .with_context(|| {
      format!("failed to write {}", self.output_path.display())
    })?;

    println!("Output written to {}", self.output_path.display());

    Ok(())
  }
}
