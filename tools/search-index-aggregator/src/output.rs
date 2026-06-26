use super::*;

#[derive(Debug, Eq, PartialEq, Serialize)]
pub(super) struct Output {
  pub(super) courses: Vec<Course>,
  pub(super) instructors: Vec<String>,
}
