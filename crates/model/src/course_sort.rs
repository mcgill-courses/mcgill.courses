use super::*;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CourseSort {
  pub sort_type: CourseSortType,
  pub reverse: bool,
}
