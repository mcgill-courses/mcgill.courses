use super::*;

#[derive(
  Clone, Debug, Serialize, Deserialize, Hash, Eq, PartialEq, ToSchema,
)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct Review {
  /// The text content of the review.
  pub content: String,
  /// The course ID this review is for.
  pub course_id: String,
  /// Difficulty rating from 1-5.
  pub difficulty: u32,
  /// List of instructor names for this review.
  pub instructors: Vec<String>,
  /// Number of likes (net of dislikes) this review has received.
  pub likes: i32,
  /// Overall rating from 1-5.
  pub rating: u32,
  /// Timestamp when the review was created or last updated.
  #[typeshare(serialized_as = "String")]
  pub timestamp: DateTime,
  /// The term this review was written for (e.g. "Fall 2025").
  pub term: Option<String>,
  /// The user ID of the review author.
  pub user_id: String,
}

impl Default for Review {
  fn default() -> Self {
    Self {
      content: String::new(),
      course_id: String::new(),
      difficulty: 0,
      instructors: vec![],
      likes: 0,
      rating: 0,
      timestamp: DateTime::from_millis(0),
      term: None,
      user_id: String::new(),
    }
  }
}

impl Into<Bson> for Review {
  fn into(self) -> Bson {
    Bson::Document(doc! {
      "content": self.content,
      "courseId": self.course_id,
      "difficulty": self.difficulty,
      "instructors": self.instructors,
      "rating": self.rating,
      "timestamp": self.timestamp.timestamp_millis().to_string(),
      "userId": self.user_id,
      "term": self.term,
      "likes": self.likes
    })
  }
}

#[cfg(test)]
mod tests {
  use {
    super::*,
    serde_json::{Value, json},
  };

  #[test]
  fn serialize_datetime_as_string() {
    let timestamp = DateTime::from_millis(1640995200000); // 2022-01-01 00:00:00 UTC

    let review = Review {
      content: "Test review".to_string(),
      course_id: "COMP101".to_string(),
      difficulty: 3,
      instructors: vec!["Dr. Smith".to_string()],
      likes: 5,
      rating: 4,
      timestamp,
      user_id: "user123".to_string(),
    };

    let json =
      serde_json::to_value(&review).expect("failed to serialize review");

    assert_eq!(
      json["timestamp"],
      Value::String("1640995200000".to_string())
    );
  }

  #[test]
  fn deserialize_string_timestamp() {
    let json = json!({
      "content": "Test review",
      "courseId": "COMP101",
      "difficulty": 3,
      "instructors": ["Dr. Smith"],
      "likes": 5,
      "rating": 4,
      "timestamp": "1640995200000",
      "userId": "user123"
    });

    let review: Review =
      serde_json::from_value(json).expect("failed to deserialize review");

    assert_eq!(review.timestamp.timestamp_millis(), 1640995200000);
    assert_eq!(review.content, "Test review");
    assert_eq!(review.course_id, "COMP101");
  }

  #[test]
  fn deserialize_legacy_mongodb_timestamp() {
    let json = json!({
      "content": "Test review",
      "courseId": "COMP101",
      "difficulty": 3,
      "instructors": ["Dr. Smith"],
      "likes": 5,
      "rating": 4,
      "timestamp": {
        "$date": {
          "$numberLong": "1640995200000"
        }
      },
      "userId": "user123"
    });

    let review: Review = serde_json::from_value(json)
      .expect("failed to deserialize legacy review");

    assert_eq!(review.timestamp.timestamp_millis(), 1640995200000);
    assert_eq!(review.content, "Test review");
  }

  #[test]
  fn deserialize_invalid_string_timestamp() {
    let json = json!({
      "content": "Test review",
      "courseId": "COMP101",
      "difficulty": 3,
      "instructors": ["Dr. Smith"],
      "likes": 5,
      "rating": 4,
      "timestamp": "not-a-number",
      "userId": "user123"
    });

    let result = serde_json::from_value::<Review>(json);

    assert!(result.is_err());

    assert!(
      result
        .unwrap_err()
        .to_string()
        .contains("invalid timestamp string")
    );
  }

  #[test]
  fn deserialize_malformed_mongodb_timestamp() {
    let json = json!({
      "content": "Test review",
      "courseId": "COMP101",
      "difficulty": 3,
      "instructors": ["Dr. Smith"],
      "likes": 5,
      "rating": 4,
      "timestamp": {
        "$date": "invalid-format"
      },
      "userId": "user123"
    });

    let result = serde_json::from_value::<Review>(json);

    assert!(result.is_err());

    assert!(
      result
        .unwrap_err()
        .to_string()
        .contains("'$date' field must be an object")
    );
  }

  #[test]
  fn deserialize_missing_numberlong() {
    let json = json!({
      "content": "Test review",
      "courseId": "COMP101",
      "difficulty": 3,
      "instructors": ["Dr. Smith"],
      "likes": 5,
      "rating": 4,
      "timestamp": {
        "$date": {}
      },
      "userId": "user123"
    });

    let result = serde_json::from_value::<Review>(json);

    assert!(result.is_err());

    assert!(
      result
        .unwrap_err()
        .to_string()
        .contains("missing '$numberLong' field")
    );
  }

  #[test]
  fn deserialize_invalid_timestamp_type() {
    let json = json!({
      "content": "Test review",
      "courseId": "COMP101",
      "difficulty": 3,
      "instructors": ["Dr. Smith"],
      "likes": 5,
      "rating": 4,
      "timestamp": 123, // Number instead of string or object
      "userId": "user123"
    });

    let result = serde_json::from_value::<Review>(json);

    assert!(result.is_err());

    assert!(
      result
        .unwrap_err()
        .to_string()
        .contains("expected either a timestamp string or MongoDB date object")
    );
  }

  #[test]
  fn roundtrip_serialization() {
    let original = Review {
      content: "Round trip test".to_string(),
      course_id: "MATH200".to_string(),
      difficulty: 2,
      instructors: vec!["Prof. Johnson".to_string(), "Dr. Lee".to_string()],
      likes: 10,
      rating: 5,
      timestamp: DateTime::from_millis(1672531200000), // 2023-01-01 00:00:00 UTC
      user_id: "user456".to_string(),
    };

    let json = serde_json::to_value(&original).expect("failed to serialize");

    let deserialized: Review =
      serde_json::from_value(json).expect("failed to deserialize");

    assert_eq!(original, deserialized);
  }
}
