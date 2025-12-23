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
  pub campus: Option<String>,
  pub display: Option<String>,
  pub location: Option<String>,
  pub timeblocks: Option<Vec<TimeBlock>>,
  pub crn: Option<String>,
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
  pub day: Option<String>,
  pub t1: Option<String>,
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
  pub blocks: Option<Vec<Block>>,
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
