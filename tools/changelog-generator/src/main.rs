use {
  anyhow::{Error, anyhow},
  async_openai::types::responses::CreateResponseArgs,
  chrono::{DateTime, Utc},
  clap::Parser,
  dotenv::dotenv,
  octocrab::{models, params},
  serde::{Deserialize, Serialize},
  std::{
    collections::HashMap,
    fmt::Display,
    fs::{self, File},
    path::PathBuf,
    process,
  },
  tracing::info,
  tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt},
  typeshare::typeshare,
};

const BASE_URL: &str = "https://github.com";

#[derive(Debug)]
struct PullRequest<'a> {
  title: Option<&'a str>,
  description: Option<&'a str>,
  number: u64,
  merged_at: Option<DateTime<Utc>>,
  user: &'a str,
  repository: &'a str,
}

impl Display for PullRequest<'_> {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.title.unwrap_or_default())
  }
}

impl PullRequest<'_> {
  async fn summary(&self) -> Result<Option<String>> {
    info!("Generating summary for pull request #{}", self.number);

    if self.title.is_none() && self.description.is_none() {
      return Ok(None);
    }

    let client = async_openai::Client::new();

    let mut prompt = String::new();

    prompt.push_str(include_str!("../prompt.txt"));

    if let Some(title) = self.title {
      prompt.push_str(&format!("\nTitle of the pull request: {title}\n"));
    }

    if let Some(description) = self.description {
      prompt.push_str(&format!(
        "Description of the pull request: {description}\n",
      ));
    }

    let request = CreateResponseArgs::default()
      .model("gpt-4.1-nano")
      .input(prompt)
      .max_output_tokens(512u32)
      .build()?;

    let response = client.responses().create(request).await?;

    let summary = response
      .output_text()
      .ok_or_else(|| anyhow!("No output text in response"))?
      .trim()
      .to_string();

    info!("Generated: {summary}");

    Ok(Some(summary))
  }

  fn url(self) -> Result<String> {
    Ok(format!(
      "{}/{}/{}/pull/{}",
      BASE_URL, self.user, self.repository, self.number
    ))
  }
}

#[derive(Clone, Debug, Serialize, Deserialize, Eq, Hash, PartialEq)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct ChangelogItem {
  pub number: u32,
  pub summary: Option<String>,
  pub url: String,
  #[serde(alias = "merged_at")]
  #[typeshare(serialized_as = "String")]
  pub merged_at: DateTime<Utc>,
}

impl ChangelogItem {
  async fn try_from(
    pull_request: PullRequest<'_>,
    merged_at: DateTime<Utc>,
    number: u32,
  ) -> Result<ChangelogItem> {
    Ok(ChangelogItem {
      number,
      summary: pull_request.summary().await?,
      url: pull_request.url()?,
      merged_at,
    })
  }
}

type Entry = HashMap<String, Vec<ChangelogItem>>;

#[derive(Parser)]
struct Arguments {
  #[clap(long, default_value = "../../client/src/assets/changelog.json")]
  output: PathBuf,
  #[clap(long, value_delimiter = ' ', num_args = 0..)]
  regenerate: Vec<u32>,
  #[clap(long, default_value = "false")]
  regenerate_all: bool,
  #[clap(long, default_value = "mcgill.courses")]
  repo: String,
  #[clap(long, default_value = "mcgill-courses")]
  user: String,
}

impl Arguments {
  async fn run(&self) -> Result {
    let client = octocrab::instance();

    let page = client
      .pulls(&self.user, &self.repo)
      .list()
      .state(params::State::All)
      .per_page(50)
      .send()
      .await?;

    let model = client.all_pages::<models::pulls::PullRequest>(page).await?;

    info!("Reading existing entries from {}", self.output.display());

    if !self.output.exists() {
      File::create(&self.output)?;
    }

    let content = fs::read_to_string(&self.output)?;

    let existing_items = serde_json::from_str::<Entry>(&content)
      .map(|entry| {
        entry
          .into_iter()
          .flat_map(|(_, value)| {
            value.into_iter().map(|item| (item.number, item))
          })
          .collect::<HashMap<u32, ChangelogItem>>()
      })
      .unwrap_or_else(|_| HashMap::<u32, ChangelogItem>::new());

    let pull_requests = model
      .iter()
      .map(|pull_request| PullRequest {
        title: pull_request.title.as_deref(),
        description: pull_request.body.as_deref(),
        number: pull_request.number,
        merged_at: pull_request.merged_at,
        user: &self.user,
        repository: &self.repo,
      })
      .collect::<Vec<_>>();

    let mut grouped: Entry = HashMap::new();

    for pull_request in pull_requests {
      if let Some(merged_at) = pull_request.merged_at {
        let number = u32::try_from(pull_request.number).map_err(|_| {
          anyhow!("pull request number {} exceeds u32", pull_request.number)
        })?;

        let month = merged_at.format("%B %Y").to_string();

        if let Some(item) = existing_items.get(&number) {
          if self.regenerate_all || self.regenerate.contains(&number) {
            grouped.entry(month).or_default().push(
              ChangelogItem::try_from(pull_request, merged_at, number).await?,
            );
          } else {
            grouped.entry(month).or_default().push(item.clone());
          }
        } else {
          grouped.entry(month).or_default().push(
            ChangelogItem::try_from(pull_request, merged_at, number).await?,
          );
        }
      }
    }

    if !grouped.is_empty() {
      info!("Writing to {}", self.output.display());

      for items in grouped.values_mut() {
        items.sort_by(|a, b| b.merged_at.cmp(&a.merged_at));
      }

      fs::write(&self.output, serde_json::to_string_pretty(&grouped)?)?;
    }

    info!("Generated changelog successfully");

    Ok(())
  }
}

type Result<T = (), E = Error> = std::result::Result<T, E>;

#[tokio::main]
async fn main() {
  tracing_subscriber::registry()
    .with(
      tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info".into()),
    )
    .with(tracing_subscriber::fmt::layer())
    .init();

  dotenv().ok();

  if let Err(error) = Arguments::parse().run().await {
    eprintln!("error: {error}");
    process::exit(1);
  }
}
