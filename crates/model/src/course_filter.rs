use super::*;

#[derive(Debug, Clone, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CourseFilter {
  pub levels: Option<Vec<String>>,
  pub query: Option<String>,
  pub subjects: Option<Vec<String>>,
  pub terms: Option<Vec<String>>,
  pub sort_by: Option<CourseSort>,
}
