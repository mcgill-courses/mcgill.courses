use super::*;

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub enum CourseSortType {
  /// Sort by course difficulty.
  Difficulty,
  /// Sort by course rating.
  Rating,
  /// Sort by number of reviews.
  ReviewCount,
}

impl<'de> Deserialize<'de> for CourseSortType {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    let string = Cow::<'_, str>::deserialize(deserializer)?;

    match string.as_ref() {
      "difficulty" => Ok(CourseSortType::Difficulty),
      "rating" => Ok(CourseSortType::Rating),
      "reviewCount" => Ok(CourseSortType::ReviewCount),
      _ => Err(Error::custom(format!("unknown sort type: {string}"))),
    }
  }
}
