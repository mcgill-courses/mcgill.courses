use super::*;

#[derive(Debug, Deserialize)]
struct SeedInstructor {
  name: String,
}

#[derive(Debug, Deserialize)]
struct SeedCourse {
  #[serde(rename = "_id")]
  id: String,
  title: String,
  #[serde(default)]
  terms: Vec<String>,
  instructors: Vec<SeedInstructor>,
}

#[derive(Debug)]
pub(super) struct Seed {
  pub(super) courses: Vec<Course>,
  pub(super) instructors: BTreeSet<String>,
}

impl Seed {
  pub(super) fn read(path: &Path) -> Result<Self> {
    let file = File::open(path)
      .with_context(|| format!("failed to open {}", path.display()))?;

    let seed_courses =
      serde_json::from_reader::<_, Vec<SeedCourse>>(BufReader::new(file))
        .with_context(|| format!("failed to parse {}", path.display()))?;

    let (mut courses, mut instructors) =
      (Vec::with_capacity(seed_courses.len()), BTreeSet::new());

    for course in seed_courses {
      let SeedCourse {
        id,
        title,
        terms,
        instructors: seed_instructors,
      } = course;

      courses.push(Course { id, title, terms });

      for instructor in seed_instructors {
        instructors.insert(instructor.name);
      }
    }

    Ok(Self {
      courses,
      instructors,
    })
  }
}
