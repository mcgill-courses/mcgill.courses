use super::*;

#[derive(Debug, Eq, PartialEq, Serialize)]
pub(super) struct Course {
  pub(super) id: String,
  pub(super) title: String,
  pub(super) terms: Vec<String>,
}
