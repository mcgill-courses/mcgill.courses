use super::*;

#[derive(Debug, Parser)]
#[command(
  author,
  version,
  about = "Aggregate course data from seed files and export to JSON."
)]
pub(super) struct Arguments {
  #[arg(
    short,
    long,
    default_value_os_t = default_seed_path(),
    help = "Path to the directory containing seed files."
  )]
  seed_path: PathBuf,
  #[arg(
    short,
    long,
    default_value_os_t = default_output_path(),
    help = "Path to the output JSON file."
  )]
  output_path: PathBuf,
}

impl Arguments {
  pub(super) fn run(self) -> Result {
    let mut data_paths = fs::read_dir(&self.seed_path)
      .with_context(|| format!("failed to read {}", self.seed_path.display()))?
      .map(|entry| entry.map(|entry| entry.path()))
      .collect::<std::io::Result<Vec<_>>>()
      .with_context(|| format!("failed to read {}", self.seed_path.display()))?
      .into_iter()
      .filter(|path| path.is_file())
      .filter(|path| {
        path
          .file_name()
          .and_then(|name| name.to_str())
          .is_some_and(|name| {
            name.starts_with("courses-") && name.ends_with(".json")
          })
      })
      .collect::<Vec<_>>();

    data_paths.sort();

    let seed_data = data_paths
      .par_iter()
      .map(|path| seed::Seed::read(path))
      .collect::<Vec<_>>();

    let mut course_ids = Vec::new();

    let (mut courses, mut instructors) = (HashMap::new(), BTreeSet::new());

    for seed_data in seed_data {
      let seed_data = seed_data?;

      for course in seed_data.courses {
        let id = course.id.clone();

        if !courses.contains_key(&id) {
          course_ids.push(id.clone());
        }

        courses.insert(id, course);
      }

      instructors.extend(seed_data.instructors);
    }

    let courses = course_ids
      .iter()
      .map(|id| {
        courses
          .remove(id)
          .expect("course ID should have matching course data")
      })
      .collect::<Vec<Course>>();

    let output = serde_json::to_string_pretty(&Output {
      courses,
      instructors: instructors.into_iter().collect(),
    })?;

    fs::write(&self.output_path, output).with_context(|| {
      format!("failed to write {}", self.output_path.display())
    })?;

    println!("Output written to {}", self.output_path.display());

    Ok(())
  }
}
