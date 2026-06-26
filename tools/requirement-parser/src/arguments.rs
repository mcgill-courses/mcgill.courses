use super::*;

#[derive(Debug, Parser)]
#[command(
  author,
  version,
  about = "Parse logical course requirements from existing data."
)]
pub(super) struct Arguments {
  #[arg(help = "The path to the course JSON file.")]
  file: PathBuf,
  #[arg(
    short,
    long,
    default_value_t = 1000,
    help = "The delay between requests in milliseconds."
  )]
  delay: u64,
  #[arg(
    short,
    long,
    help = "Reparse all courses, even if they already have parsed requirements."
  )]
  overwrite: bool,
  #[arg(long, alias = "api-url", default_value = DEFAULT_API_BASE, hide = true)]
  api_base: String,
}

impl Arguments {
  pub(super) async fn run(self) -> Result {
    dotenv().ok();

    let client = OpenAiClient::new()?;

    let mut courses = serde_json::from_str::<Vec<Course>>(
      &fs::read_to_string(&self.file)
        .with_context(|| format!("failed to read {}", self.file.display()))?,
    )
    .with_context(|| format!("failed to parse {}", self.file.display()))?;

    let num_courses = courses.len();

    for (i, course) in courses.iter_mut().enumerate() {
      let course_code = course.id.clone();

      let result = self
        .parse_course(&client, course, &course_code, i, num_courses)
        .await;

      if let Err(error) = result {
        println!("Failed to parse requirements, skipping...");
        println!("error: {error}");
      }
    }

    fs::write(&self.file, serde_json::to_string_pretty(&courses)?)
      .with_context(|| format!("failed to write {}", self.file.display()))?;

    Ok(())
  }

  async fn parse_course(
    &self,
    client: &OpenAiClient,
    course: &mut Course,
    course_code: &str,
    index: usize,
    num_courses: usize,
  ) -> Result {
    if !self.overwrite && course.has_logical_requirements() {
      return Ok(());
    }

    let progress = format!("({}/{num_courses})", index + 1);

    if course.prerequisites.is_empty() && course.corequisites.is_empty() {
      println!(
        "{progress} {course_code} does not have any requirements, skipping..."
      );
      return Ok(());
    }

    println!("{progress} Parsing requirements {course_code}...");

    let prerequisites = if course.prerequisites.is_empty() {
      None
    } else {
      parse_requirement_text(
        client,
        course_code,
        "prerequisitesText",
        course.prerequisites_text.as_deref(),
        &course.prerequisites,
      )
      .await?
    };

    let corequisites = if course.corequisites.is_empty() {
      None
    } else {
      parse_requirement_text(
        client,
        course_code,
        "corequisitesText",
        course.corequisites_text.as_deref(),
        &course.corequisites,
      )
      .await?
    };

    println!("---Postprocessed---");
    println!("Prerequisites: {prerequisites:?}");
    println!("Corequisites: {corequisites:?}");
    println!();

    course.logical_prerequisites = prerequisites;
    course.logical_corequisites = corequisites;

    thread::sleep(Duration::from_millis(self.delay));

    Ok(())
  }
}
