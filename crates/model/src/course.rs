use super::*;

#[derive(
  Clone, Debug, Default, Deserialize, Derivative, Serialize, ToSchema,
)]
#[derivative(Eq, Hash, PartialEq)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct Course {
  /// Unique course identifier.
  #[serde(rename = "_id")]
  pub id: String,
  /// Search n-grams for the course ID.
  pub id_ngrams: Option<String>,
  /// Course title.
  pub title: String,
  /// Search n-grams for the course title.
  pub title_ngrams: Option<String>,
  /// Credit value as listed in the catalog.
  pub credits: String,
  /// Subject code (e.g., "COMP").
  pub subject: String,
  /// Course number (e.g., "202").
  pub code: String,
  /// Catalog URL for the course.
  pub url: String,
  /// Department offering the course.
  pub department: String,
  /// Faculty offering the course.
  pub faculty: String,
  /// Terms when the course is offered.
  pub terms: Vec<String>,
  /// Course description.
  pub description: String,
  /// Instructors associated with the course.
  pub instructors: Vec<Instructor>,
  /// Raw prerequisites text from the catalog.
  pub prerequisites_text: Option<String>,
  /// Raw corequisites text from the catalog.
  pub corequisites_text: Option<String>,
  /// List of prerequisite course codes.
  pub prerequisites: Vec<String>,
  /// List of corequisite course codes.
  pub corequisites: Vec<String>,
  /// Course codes that list this course as a prerequisite.
  pub leading_to: Vec<String>,
  /// Structured prerequisites expression.
  pub logical_prerequisites: Option<ReqNode>,
  /// Structured corequisites expression.
  pub logical_corequisites: Option<ReqNode>,
  /// Restriction text from the catalog.
  pub restrictions: Option<String>,
  /// Schedule offerings for the course.
  pub schedule: Option<Vec<Schedule>>,
  /// Average rating across reviews.
  #[derivative(PartialEq = "ignore")]
  #[derivative(Hash = "ignore")]
  #[serde(default = "zero_f32")]
  pub avg_rating: f32,
  /// Average difficulty across reviews.
  #[derivative(PartialEq = "ignore")]
  #[derivative(Hash = "ignore")]
  #[serde(default = "zero_f32")]
  pub avg_difficulty: f32,
  /// Number of reviews for the course.
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
      instructors: self.instructors.combine(other.instructors),
      logical_corequisites: other
        .logical_corequisites
        .or(self.logical_corequisites),
      logical_prerequisites: other
        .logical_prerequisites
        .or(self.logical_prerequisites),
      schedule: Some(self.schedule.combine_opt(other.schedule)),
      terms: self.terms.combine(other.terms),
      ..other
    }
  }
}
