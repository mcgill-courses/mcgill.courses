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
pub struct Block {
  /// Campus code or name for the block.
  pub campus: Option<String>,
  /// Display string for the block.
  pub display: Option<String>,
  /// Location string for the block.
  pub location: Option<String>,
  /// Time blocks associated with this block.
  pub timeblocks: Option<Vec<TimeBlock>>,
  /// Course reference number for the block.
  pub crn: Option<String>,
  /// Instructors associated with the block (not serialized).
  #[serde(skip)]
  pub instructors: Vec<String>,
}

impl Into<Bson> for Block {
  fn into(self) -> bson::Bson {
    Bson::Document(doc! {
      "campus": self.campus,
      "display": self.display,
      "location": self.location,
      "timeblocks": self.timeblocks,
      "crn": self.crn,
    })
  }
}

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
pub struct TimeBlock {
  /// Day of week for the time block.
  pub day: Option<String>,
  /// Start time value for the block.
  pub t1: Option<String>,
  /// End time value for the block.
  pub t2: Option<String>,
}

impl Into<Bson> for TimeBlock {
  fn into(self) -> bson::Bson {
    Bson::Document(doc! {
      "day": self.day,
      "t1": self.t1,
      "t2": self.t2,
    })
  }
}

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
pub struct Schedule {
  /// Schedule blocks for the term.
  pub blocks: Option<Vec<Block>>,
  /// Term identifier for the schedule.
  pub term: Option<String>,
}

impl Into<Bson> for Schedule {
  fn into(self) -> bson::Bson {
    Bson::Document(doc! {
      "blocks": self.blocks,
      "term": self.term,
    })
  }
}
