use super::*;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct CoursePage {
  pub title: String,
  pub credits: String,
  pub subject: String,
  pub code: String,
  pub terms: Vec<Term>,
  pub description: String,
  pub department: Option<String>,
  pub faculty: Option<String>,
  pub instructors: Vec<Instructor>,
  pub requirements: Requirements,
}
