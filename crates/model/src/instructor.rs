use super::*;

#[derive(
  Clone,
  Debug,
  Default,
  Deserialize,
  Eq,
  Hash,
  Ord,
  PartialEq,
  PartialOrd,
  Serialize,
  ToSchema,
)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct Instructor {
  /// Instructor display name.
  pub name: String,
  /// Search n-grams for the instructor name.
  pub name_ngrams: Option<String>,
  /// Term identifier for the instructor record.
  pub term: String,
}

impl Into<Bson> for Instructor {
  fn into(self) -> bson::Bson {
    Bson::Document(doc! {
      "name": self.name,
      "name_ngrams": self.name_ngrams,
      "term": self.term,
    })
  }
}

impl Instructor {
  pub fn set_name(self, parts: &[&str]) -> Self {
    Self {
      name: format!(
        "{} {}",
        parts.get(1).unwrap_or(&""),
        parts.first().unwrap_or(&"")
      ),
      ..self
    }
  }

  pub fn set_term(self, term: &str) -> Self {
    Self {
      term: term.to_owned(),
      ..self
    }
  }
}
