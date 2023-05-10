use super::*;

#[derive(Clone, Debug, Serialize, Deserialize, Hash, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Review {
  pub content: String,
  pub course_id: String,
  pub instructor: String,
  pub rating: u32,
  #[serde(deserialize_with = "deserialize_timestamp")]
  pub timestamp: DateTime,
  pub user_id: String,
}

struct TimestampVisitor;

impl<'de> Visitor<'de> for TimestampVisitor {
  type Value = DateTime;

  fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
    formatter.write_str("an integer or a DateTime map")
  }

  fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
  where
    E: de::Error,
  {
    let value = value
      .try_into()
      .map_err(|_| de::Error::custom("Failed to convert u64".to_string()))?;

    Ok(DateTime::from_chrono(
      Utc.timestamp_opt(value, 0).single().ok_or_else(|| {
        de::Error::custom("Failed to get unique conversion result")
      })?,
    ))
  }

  fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
  where
    A: MapAccess<'de>,
  {
    let mut timestamp = None;

    while let Some(key) = map.next_key::<String>()? {
      if key == "$date" {
        timestamp = map
          .next_value::<serde_json::Value>()?
          .get("$numberLong")
          .and_then(|number| {
            number.as_str().and_then(|s| s.parse::<i64>().ok())
          });
      }
    }

    let timestamp = timestamp.ok_or_else(|| {
      de::Error::custom("Failed to get timestamp from map".to_string())
    })?;

    Ok(DateTime::from_chrono(
      Utc
        .timestamp_millis_opt(timestamp)
        .single()
        .ok_or_else(|| {
          de::Error::custom("Failed to get unique conversion result")
        })?,
    ))
  }
}

fn deserialize_timestamp<'de, D>(deserializer: D) -> Result<DateTime, D::Error>
where
  D: Deserializer<'de>,
{
  deserializer.deserialize_any(TimestampVisitor)
}

impl Default for Review {
  fn default() -> Self {
    Self {
      content: String::new(),
      course_id: String::new(),
      instructor: String::new(),
      rating: 0,
      timestamp: DateTime::from_chrono::<Utc>(
        Utc.from_utc_datetime(&NaiveDateTime::default()),
      ),
      user_id: String::new(),
    }
  }
}
