use super::*;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct FinalExam {
  /// Course identifier (e.g., "COMP202").
  pub id: String,
  /// Section number (e.g., "001").
  pub section: String,
  /// Exam format (e.g., "IN-PERSON", "ONLINE").
  pub format: String,
  /// Exam type (e.g., "FORMAL EXAM").
  #[serde(rename = "type")]
  pub exam_type: String,
  /// Location where the exam is held.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub location: Option<String>,
  /// Exam start time in ISO 8601 format.
  pub start_time: String,
  /// Exam end time in ISO 8601 format.
  pub end_time: String,
}
