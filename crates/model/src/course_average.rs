use super::*;

#[derive(
  Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, ToSchema,
)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct CourseAverage {
  /// Course identifier (e.g., "COMP202").
  pub course_id: String,
  /// Term name (e.g., "Fall 2024", "Winter 2025").
  pub term: String,
  /// Letter grade average.
  pub average: Grade,
}
