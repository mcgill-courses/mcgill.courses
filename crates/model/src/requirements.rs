use super::*;

pub enum Requirement {
  Corequisites,
  Prerequisites,
  Restrictions,
  Unknown,
}

impl From<&str> for Requirement {
  fn from(s: &str) -> Self {
    match s {
      "Corequisite" => Self::Corequisites,
      "Prerequisite" => Self::Prerequisites,
      "Restriction" => Self::Restrictions,
      _ => Self::Unknown,
    }
  }
}

#[derive(
  Debug,
  PartialEq,
  Eq,
  Serialize,
  Deserialize,
  Clone,
  Hash,
  Ord,
  PartialOrd,
  ToSchema,
)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub enum Operator {
  /// All requirements must be satisfied.
  #[serde(rename = "AND")]
  And,
  /// Any requirement may be satisfied.
  #[serde(rename = "OR")]
  Or,
}

impl Into<Bson> for Operator {
  fn into(self) -> Bson {
    match self {
      Self::And => Bson::String("AND".to_string()),
      Self::Or => Bson::String("OR".to_string()),
    }
  }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Requirements {
  pub prerequisites_text: Option<String>,
  pub corequisites_text: Option<String>,
  pub corequisites: Vec<String>,
  pub prerequisites: Vec<String>,
  pub restrictions: Option<String>,
  pub logical_prerequisites: Option<RequirementNode>,
  pub logical_corequisites: Option<RequirementNode>,
}

impl Requirements {
  pub fn set_prerequisites_text(&mut self, prerequisites_text: Option<String>) {
    self.prerequisites_text = prerequisites_text;
  }

  pub fn set_corequisites_text(&mut self, corequisites_text: Option<String>) {
    self.corequisites_text = corequisites_text;
  }

  pub fn set_corequisites(&mut self, corequisites: Vec<String>) {
    self.corequisites = corequisites;
  }

  pub fn set_prerequisites(&mut self, prerequisites: Vec<String>) {
    self.prerequisites = prerequisites;
  }

  pub fn set_restrictions(&mut self, restrictions: String) {
    self.restrictions = Some(restrictions);
  }

  pub fn set_logical_prerequisites(
    &mut self,
    logical_prerequisites: Option<RequirementNode>,
  ) {
    self.logical_prerequisites = logical_prerequisites;
  }

  pub fn set_logical_corequisites(
    &mut self,
    logical_corequisites: Option<RequirementNode>,
  ) {
    self.logical_corequisites = logical_corequisites;
  }
}
