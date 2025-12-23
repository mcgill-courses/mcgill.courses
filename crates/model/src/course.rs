use super::*;

#[derive(
  Clone, Debug, Default, Deserialize, Derivative, Serialize, ToSchema,
)]
#[derivative(Eq, Hash, PartialEq)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct Course {
  #[serde(rename = "_id")]
  pub id: String,
  pub id_ngrams: Option<String>,
  pub title: String,
  pub title_ngrams: Option<String>,
  pub credits: String,
  pub subject: String,
  pub code: String,
  pub url: String,
  pub department: String,
  pub faculty: String,
  pub terms: Vec<String>,
  pub description: String,
  pub instructors: Vec<Instructor>,
  pub prerequisites_text: Option<String>,
  pub corequisites_text: Option<String>,
  pub prerequisites: Vec<String>,
  pub corequisites: Vec<String>,
  pub leading_to: Vec<String>,
  pub logical_prerequisites: Option<ReqNode>,
  pub logical_corequisites: Option<ReqNode>,
  pub restrictions: Option<String>,
  pub schedule: Option<Vec<Schedule>>,
  #[derivative(PartialEq = "ignore")]
  #[derivative(Hash = "ignore")]
  #[serde(default = "zero_f32")]
  pub avg_rating: f32,
  #[derivative(PartialEq = "ignore")]
  #[derivative(Hash = "ignore")]
  #[serde(default = "zero_f32")]
  pub avg_difficulty: f32,
  #[derivative(PartialEq = "ignore")]
  #[derivative(Hash = "ignore")]
  #[serde(default = "zero")]
  pub review_count: i32,
}

const fn zero() -> i32 {
  0
}

const fn zero_f32() -> f32 {
  0.0
}

impl Ord for Course {
  fn cmp(&self, other: &Self) -> std::cmp::Ordering {
    self.id.cmp(&other.id)
  }
}

impl PartialOrd for Course {
  fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
    Some(self.cmp(other))
  }
}

impl Course {
  pub fn merge(self, other: Course) -> Course {
    Course {
      logical_prerequisites: other
        .logical_prerequisites
        .or(self.logical_prerequisites),
      logical_corequisites: other
        .logical_corequisites
        .or(self.logical_corequisites),
      schedule: Some(other.schedule.combine_opt(self.schedule)),
      ..other
    }
  }
}
