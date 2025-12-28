use super::*;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct Subscription {
  /// Course ID the user is subscribed to.
  pub course_id: String,
  /// User ID that owns the subscription.
  pub user_id: String,
}
