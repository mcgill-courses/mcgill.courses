use super::*;

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
