use super::*;

fn deserialize_bool_from_string<'de, D>(
  deserializer: D,
) -> Result<Option<bool>, D::Error>
where
  D: Deserializer<'de>,
{
  let string: Option<Cow<'_, str>> = Option::deserialize(deserializer)?;

  match string.as_deref() {
    Some("true") => Ok(Some(true)),
    Some("false") => Ok(Some(false)),
    Some(other) => Err(Error::custom(format!("invalid boolean: {other}"))),
    None => Ok(None),
  }
}

fn deserialize_comma_separated<'de, D>(
  deserializer: D,
) -> Result<Option<Vec<String>>, D::Error>
where
  D: Deserializer<'de>,
{
  let string: Option<Cow<'_, str>> = Option::deserialize(deserializer)?;

  Ok(
    string.map(|string| {
      string.split(',').map(|string| string.to_string()).collect()
    }),
  )
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct CourseFilter {
  /// Course levels to filter by (e.g., "1", "2", "3").
  #[serde(
    default,
    deserialize_with = "deserialize_comma_separated",
    skip_serializing_if = "Option::is_none"
  )]
  pub levels: Option<Vec<String>>,
  /// Whether to reverse the sort order.
  #[serde(
    default,
    deserialize_with = "deserialize_bool_from_string",
    skip_serializing_if = "Option::is_none"
  )]
  pub sort_reverse: Option<bool>,
  /// Sort type for ordering results.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub sort_type: Option<CourseSortType>,
  /// Subject codes to filter by (e.g., "COMP", "MATH").
  #[serde(
    default,
    deserialize_with = "deserialize_comma_separated",
    skip_serializing_if = "Option::is_none"
  )]
  pub subjects: Option<Vec<String>>,
  /// Term identifiers to filter by (e.g., "Fall 2024").
  #[serde(
    default,
    deserialize_with = "deserialize_comma_separated",
    skip_serializing_if = "Option::is_none"
  )]
  pub terms: Option<Vec<String>>,
  /// Search query string.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub query: Option<String>,
}
