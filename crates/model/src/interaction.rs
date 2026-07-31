use super::*;

#[derive(
  Clone, Debug, Serialize, Deserialize, Hash, Eq, PartialEq, ToSchema,
)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub enum InteractionKind {
  /// Indicates that the user liked the review.
  Like,
  /// Indicates that the user disliked the review.
  Dislike,
}

impl Display for InteractionKind {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    match self {
      InteractionKind::Like => write!(f, "like"),
      InteractionKind::Dislike => write!(f, "dislike"),
    }
  }
}

impl Into<Bson> for InteractionKind {
  fn into(self) -> bson::Bson {
    Bson::String(self.to_string())
  }
}

#[derive(
  Clone, Debug, Serialize, Deserialize, Hash, Eq, PartialEq, ToSchema,
)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct Interaction {
  /// Kind of interaction that occurred.
  pub kind: InteractionKind,
  /// ID of the user associated with the interaction.
  pub user_id: String,
  /// ID of the course the interaction belongs to.
  pub course_id: String,
  /// ID of the user who created the interaction.
  pub referrer: String,
}
