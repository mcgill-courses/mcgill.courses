use super::*;

#[derive(Debug, Deserialize)]
pub(super) struct Response {
  pub(super) requirement: Option<RequirementNode>,
}
