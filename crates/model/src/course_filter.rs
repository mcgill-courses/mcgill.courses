use {super::*, serde_with::DisplayFromStr};

serde_with::serde_conv!(
  CommaSeparated,
  Vec<String>,
  |vec: &Vec<String>| vec.join(","),
  |string: String| -> Result<_, std::convert::Infallible> {
    Ok(string.split(',').map(|string| string.to_string()).collect())
  }
);

#[serde_with::serde_as]
#[derive(Debug, Clone, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct CourseFilter {
  /// Course levels to filter by (e.g., "1", "2", "3").
  #[serde_as(as = "Option<CommaSeparated>")]
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub levels: Option<Vec<String>>,
  /// Whether to reverse the sort order.
  #[serde_as(as = "Option<DisplayFromStr>")]
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub sort_reverse: Option<bool>,
  /// Sort type for ordering results.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub sort_type: Option<CourseSortType>,
  /// Subject codes to filter by (e.g., "COMP", "MATH").
  #[serde_as(as = "Option<CommaSeparated>")]
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub subjects: Option<Vec<String>>,
  /// Term identifiers to filter by (e.g., "Fall 2024").
  #[serde_as(as = "Option<CommaSeparated>")]
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub terms: Option<Vec<String>>,
  /// Search query string.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub query: Option<String>,
}
