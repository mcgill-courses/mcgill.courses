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
  #[arg(long, default_value = DEFAULT_API_URL, hide = true)]
  api_url: String,
}

impl Arguments {
  pub(super) fn run(self) -> Result {
    dotenv::dotenv().ok();

    let client = OpenAiClient::from_env(&self.api_url)?;

    let mut courses = serde_json::from_str::<Vec<Course>>(
      &fs::read_to_string(&self.file)
        .with_context(|| format!("failed to read {}", self.file.display()))?,
    )
    .with_context(|| format!("failed to parse {}", self.file.display()))?;

    let num_courses = courses.len();

    let failed_path = Path::new("failed.txt");

    let mut failed = read_failed(failed_path)?;

    for (i, course) in courses.iter_mut().enumerate() {
      let course_code = course.id.clone();

      let result = self.parse_course(
        &client,
        course,
        &course_code,
        &failed,
        i,
        num_courses,
      );

      if let Err(err) = result {
        println!("Failed to parse requirements, skipping...");
        println!("Error: {err}");
        failed.push(course_code);
      }
    }

    fs::write(&self.file, serde_json::to_string_pretty(&courses)?)
      .with_context(|| format!("failed to write {}", self.file.display()))?;

    println!(
      "Failed to parse the following course(s): {}",
      failed.join(", ")
    );

    write_failed(failed_path, &failed)
  }

  fn parse_course(
    &self,
    client: &OpenAiClient,
    course: &mut Course,
    course_code: &str,
    failed: &[String],
    index: usize,
    num_courses: usize,
  ) -> Result {
    if !self.overwrite
      && (course.logical_prerequisites.is_some()
        || course.logical_corequisites.is_some())
    {
      return Ok(());
    }

    let progress = format!("({}/{num_courses})", index + 1);

    if failed.iter().any(|failed| failed == course_code) {
      println!("{progress} {course_code} failed previously, skipping...");
      return Ok(());
    }

    if course.prerequisites.is_empty() && course.corequisites.is_empty() {
      println!(
        "{progress} {course_code} does not have any requirements, skipping..."
      );
      return Ok(());
    }

    println!("{progress} Parsing requirements {course_code}...");

    let prereqs = if course.prerequisites.is_empty() {
      None
    } else {
      parse_requirement_text(
        client,
        course_code,
        "prerequisitesText",
        course.prerequisites_text.as_deref(),
        &course.prerequisites,
      )?
    };

    let coreqs = if course.corequisites.is_empty() {
      None
    } else {
      parse_requirement_text(
        client,
        course_code,
        "corequisitesText",
        course.corequisites_text.as_deref(),
        &course.corequisites,
      )?
    };

    println!("---Postprocessed---");
    println!("Prerequisites: {prereqs:?}");
    println!("Corequisites: {coreqs:?}");
    println!();

    course.logical_prerequisites = prereqs;
    course.logical_corequisites = coreqs;

    thread::sleep(Duration::from_millis(self.delay));

    Ok(())
  }
}
