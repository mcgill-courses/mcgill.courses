use super::*;

#[derive(
  Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, ToSchema,
)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct CourseAverage {
  pub course_id: String,
  pub term: String,
  pub average: String,
}
