use super::*;

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct Course {
  pub title: String,
  pub credits: String,
  pub subject: String,
  pub code: String,
  pub level: String,
  pub url: String,
  pub department: String,
  pub faculty: String,
  pub faculty_url: String,
  pub terms: Vec<String>,
  pub description: String,
  pub instructors: Vec<Instructor>,
  pub prerequisites: Vec<String>,
  pub corequisites: Vec<String>,
  pub restrictions: Option<String>,
  pub schedule: Vec<Schedule>,
}
