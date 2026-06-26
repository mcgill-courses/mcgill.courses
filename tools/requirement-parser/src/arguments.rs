use super::*;

#[derive(Clap, Debug)]
#[command(
  author,
  version,
  about = "Parse logical course requirements from existing data."
)]
pub(super) struct Arguments {
  #[arg(
    long = "base-url",
    default_value = DEFAULT_BASE_URL,
    help = "The OpenAI API base URL."
  )]
  base_url: String,
  #[arg(
    short,
    long,
    default_value_t = 1000,
    help = "The delay between requests in milliseconds."
  )]
  delay: u64,
  #[arg(help = "The path to the course JSON file.")]
  file: PathBuf,
  #[arg(
    short,
    long,
    help = "Reparse all courses, even if they already have parsed requirements."
  )]
  overwrite: bool,
}

impl Arguments {
  pub(super) async fn run(self) -> Result {
    dotenv().ok();

    let parser = Parser::new(&self.base_url)?;

    let contents = fs::read_to_string(&self.file)
      .with_context(|| format!("failed to read {}", self.file.display()))?;

    let mut courses = serde_json::from_str::<Vec<model::Course>>(&contents)
      .with_context(|| format!("failed to parse {}", self.file.display()))?;

    let course_count = courses.len();

    let mut summary = Summary::default();

    'courses: for (i, course) in courses.iter_mut().enumerate() {
      let course_code = course.id.clone();

      let progress = Progress {
        current: i + 1,
        total: course_count,
        course: &course_code,
      };

      if !self.overwrite && course.has_logical_requirements() {
        summary.skipped_existing += 1;
        continue;
      }

      if course.prerequisites.is_empty() && course.corequisites.is_empty() {
        summary.skipped_without_requirements += 1;
        continue;
      }

      println!("{progress}");

      let prerequisites = 'prerequisites: {
        if course.prerequisites.is_empty() {
          break 'prerequisites None;
        }

        let Some(text) = course.prerequisites_text.as_deref() else {
          println!("  prerequisites failed: missing `prerequisitesText`");
          println!();
          summary.failed += 1;
          continue 'courses;
        };

        match parser.parse(text, &course.prerequisites).await {
          Ok(requirements) => requirements,
          Err(error) => {
            println!("  prerequisites failed: {error:#}");
            println!();
            summary.failed += 1;
            continue 'courses;
          }
        }
      };

      let corequisites = 'corequisites: {
        if course.corequisites.is_empty() {
          break 'corequisites None;
        }

        let Some(text) = course.corequisites_text.as_deref() else {
          println!("  corequisites failed: missing `corequisitesText`");
          println!();
          summary.failed += 1;
          continue 'courses;
        };

        match parser.parse(text, &course.corequisites).await {
          Ok(requirements) => requirements,
          Err(error) => {
            println!("  corequisites failed: {error:#}");
            println!();
            summary.failed += 1;
            continue 'courses;
          }
        }
      };

      println!(
        "  prerequisites: {}",
        prerequisites
          .as_ref()
          .map_or_else(|| "none".to_string(), ToString::to_string)
      );

      println!(
        "  corequisites: {}",
        corequisites
          .as_ref()
          .map_or_else(|| "none".to_string(), ToString::to_string)
      );

      println!();

      course.logical_prerequisites = prerequisites;
      course.logical_corequisites = corequisites;

      summary.updated += 1;

      sleep(Duration::from_millis(self.delay)).await;
    }

    fs::write(&self.file, serde_json::to_string_pretty(&courses)?)?;

    println!("Summary: {summary}.");
    println!("Output written to {}", self.file.display());

    Ok(())
  }
}
