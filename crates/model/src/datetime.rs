use super::*;

#[derive(Clone, Debug, Hash, Eq, PartialEq)]
pub struct DateTime(pub BsonDateTime);

impl From<BsonDateTime> for DateTime {
  fn from(dt: BsonDateTime) -> Self {
    DateTime(dt)
  }
}

impl From<DateTime> for BsonDateTime {
  fn from(wrapper: DateTime) -> Self {
    wrapper.0
  }
}

impl From<DateTime> for Bson {
  fn from(wrapper: DateTime) -> Self {
    Bson::DateTime(wrapper.0)
  }
}

impl From<ChronoDateTime<Utc>> for DateTime {
  fn from(dt: ChronoDateTime<Utc>) -> Self {
    DateTime(BsonDateTime::from_chrono(dt))
  }
}

impl Ord for DateTime {
  fn cmp(&self, other: &Self) -> Ordering {
    self.0.cmp(&other.0)
  }
}

impl PartialOrd for DateTime {
  fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
    Some(self.cmp(other))
  }
}

impl ToSchema for DateTime {
  fn name() -> Cow<'static, str> {
    Cow::Borrowed("DateTime")
  }
}

impl PartialSchema for DateTime {
  fn schema() -> RefOr<Schema> {
    Object::builder()
      .schema_type(Type::String)
      .description(Some(
        "Unix timestamp in milliseconds, encoded as a decimal string",
      ))
      .pattern(Some(r"^-?\d+$"))
      .examples(["1672531200000"])
      .into()
  }
}

impl Serialize for DateTime {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    serializer.serialize_str(&self.0.timestamp_millis().to_string())
  }
}

impl<'de> Deserialize<'de> for DateTime {
  /// Deserializes DateTime from either string or MongoDB object format for backward
  /// compatibility.
  ///
  /// This function handles two different timestamp formats during deserialization.
  /// The new format expects timestamps as string representations of milliseconds
  /// since Unix epoch (e.g., "1640995200000"), which matches the typeshare-generated
  /// TypeScript types. However, existing database records contain timestamps in
  /// MongoDB's extended JSON format with nested objects like {"$date":
  /// {"$numberLong": "1640995200000"}}.
  ///
  /// The dual format support exists because historical reviews in the database were
  /// stored using MongoDB's native BSON DateTime serialization, while new records
  /// use the string format for consistency with frontend expectations.
  fn deserialize<D>(deserializer: D) -> Result<DateTime, D::Error>
  where
    D: Deserializer<'de>,
  {
    let value = Value::deserialize(deserializer)?;

    match value {
      Value::String(millis_str) => Ok(DateTime::from_millis(
        millis_str.parse::<i64>().map_err(|error| {
          D::Error::custom(format!(
            "invalid timestamp string '{}': {}",
            millis_str, error
          ))
        })?,
      )),
      Value::Object(map) => {
        let date_obj = map.get("$date").ok_or_else(|| {
          D::Error::custom("missing '$date' field in timestamp object")
        })?;

        let number_long_obj = date_obj
          .as_object()
          .ok_or_else(|| D::Error::custom("'$date' field must be an object"))?;

        let number_long_str = number_long_obj
          .get("$numberLong")
          .ok_or_else(|| {
            D::Error::custom("missing '$numberLong' field in $date object")
          })?
          .as_str()
          .ok_or_else(|| {
            D::Error::custom("'$numberLong' field must be a string")
          })?;

        let millis = number_long_str.parse::<i64>().map_err(|error| {
          D::Error::custom(format!(
            "invalid $numberLong value '{}': {}",
            number_long_str, error
          ))
        })?;

        Ok(DateTime::from_millis(millis))
      }
      _ => Err(D::Error::custom(
        "expected either a timestamp string or MongoDB date object",
      )),
    }
  }
}

impl DateTime {
  pub fn from_millis(millis: i64) -> Self {
    DateTime(BsonDateTime::from_millis(millis))
  }

  pub fn timestamp_millis(&self) -> i64 {
    self.0.timestamp_millis()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn schema_matches_serialization() {
    assert_eq!(
      serde_json::to_value(DateTime::schema()).unwrap(),
      serde_json::json!({
        "type": "string",
        "description": "Unix timestamp in milliseconds, encoded as a decimal string",
        "examples": ["1672531200000"],
        "pattern": "^-?\\d+$",
      }),
    );
  }
}
