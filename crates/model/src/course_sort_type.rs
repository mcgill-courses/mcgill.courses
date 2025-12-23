use super::*;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum CourseSortType {
  Difficulty,
  Rating,
  ReviewCount,
}
