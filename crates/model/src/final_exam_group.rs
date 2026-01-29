use super::*;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct FinalExamGroup {
  /// Term name (e.g., "Fall 2025", "Winter 2026").
  pub term: String,
  /// URL to the official exam schedule PDF.
  pub url: String,
  /// List of final exams for this term.
  pub exams: Vec<FinalExam>,
}
