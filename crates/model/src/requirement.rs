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
