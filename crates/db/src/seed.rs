use super::*;

#[derive(Debug, Clone)]
pub(crate) enum Seed {
  CourseAverages((PathBuf, Vec<CourseAverage>)),
  Courses((PathBuf, Vec<Course>)),
  Reviews((PathBuf, Vec<Review>)),
  Unknown(PathBuf),
}

impl Seed {
  pub(crate) fn from_content(path: PathBuf, content: String) -> Self {
    match (
      serde_json::from_str::<Vec<CourseAverage>>(&content).ok(),
      serde_json::from_str::<Vec<Course>>(&content).ok(),
      serde_json::from_str::<Vec<Review>>(&content).ok(),
    ) {
      (Some(course_averages), _, _) => {
        Self::CourseAverages((path, course_averages))
      }
      (_, Some(courses), _) => Self::Courses((path, courses)),
      (_, _, Some(reviews)) => Self::Reviews((path, reviews)),
      _ => Self::Unknown(path),
    }
  }
}
