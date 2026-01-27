use super::*;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct CourseSort {
  /// Whether to reverse the sort order.
  pub reverse: bool,
  /// Sort type for ordering results.
  pub sort_type: CourseSortType,
}
