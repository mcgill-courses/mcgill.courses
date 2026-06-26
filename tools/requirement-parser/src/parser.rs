use super::*;

#[derive(Debug)]
pub(super) struct Parser {
  client: OpenAiClient,
}

impl Parser {
  pub(super) fn new(base_url: &str) -> Result<Self> {
    Ok(Self {
      client: OpenAiClient::new(base_url)?,
    })
  }

  pub(super) async fn parse(
    &self,
    requirement: &str,
    courses: &[String],
  ) -> Result<Option<RequirementNode>> {
    self
      .parse_requirement(
        requirement,
        courses.iter().map(Candidate::from).collect::<Vec<_>>(),
      )
      .await
  }

  async fn parse_requirement(
    &self,
    requirement: &str,
    candidates: Vec<Candidate>,
  ) -> Result<Option<RequirementNode>> {
    if candidates.is_empty() {
      return Ok(None);
    }

    if let [course] = candidates.as_slice() {
      return Ok(Some(RequirementNode::Course(course.to_string())));
    }

    self.client.parse_requirement(requirement, candidates).await
  }
}
