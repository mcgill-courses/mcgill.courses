use super::*;

#[derive(Debug, Parser)]
#[command(
  author,
  version,
  about = "Parse logical course requirements from existing data."
)]
pub(super) struct Arguments {
  #[arg(long, alias = "api-url", default_value = DEFAULT_API_BASE, hide = true)]
  api_base: String,
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

    let parser = parser::Parser::new(&self.api_base)?;

    let contents = fs::read_to_string(&self.file)
      .with_context(|| format!("failed to read {}", self.file.display()))?;

    let mut courses = serde_json::from_str::<Vec<model::Course>>(&contents)
      .with_context(|| format!("failed to parse {}", self.file.display()))?;

    let course_count = courses.len();

    'courses: for (i, course) in courses.iter_mut().enumerate() {
      let progress = format!("({}/{course_count})", i + 1);

      let course_code = &course.id;

      if !self.overwrite && course.has_logical_requirements() {
        continue;
      }

      if course.prerequisites.is_empty() && course.corequisites.is_empty() {
        println!(
          "{progress} {course_code} does not have any requirements, skipping..."
        );

        continue;
      }

      println!("{progress} Parsing requirements {course_code}...");

      let prerequisites = 'prerequisites: {
        if course.prerequisites.is_empty() {
          break 'prerequisites None;
        }

        let Some(text) = course.prerequisites_text.as_deref() else {
          println!(
            "Failed to parse prerequisites for {course_code}: missing `prerequisitesText`, skipping..."
          );

          continue 'courses;
        };

        match parser.parse(text, &course.prerequisites).await {
          Ok(requirements) => requirements,
          Err(error) => {
            println!(
              "Failed to parse prerequisites for {course_code}: {error}, skipping..."
            );

            continue 'courses;
          }
        }
      };

      let corequisites = 'corequisites: {
        if course.corequisites.is_empty() {
          break 'corequisites None;
        }

        let Some(text) = course.corequisites_text.as_deref() else {
          println!(
            "Failed to parse corequisites for {course_code}: missing `corequisitesText`, skipping..."
          );

          continue 'courses;
        };

        match parser.parse(text, &course.corequisites).await {
          Ok(requirements) => requirements,
          Err(error) => {
            println!(
              "Failed to parse corequisites for {course_code}: {error}, skipping..."
            );

            continue 'courses;
          }
        }
      };

      println!("---Postprocessed---");
      println!("Prerequisites: {prerequisites:?}");
      println!("Corequisites: {corequisites:?}");
      println!();

      course.logical_prerequisites = prerequisites;
      course.logical_corequisites = corequisites;

      sleep(Duration::from_millis(self.delay)).await;
    }

    fs::write(&self.file, serde_json::to_string_pretty(&courses)?)?;

    Ok(())
  }
}
