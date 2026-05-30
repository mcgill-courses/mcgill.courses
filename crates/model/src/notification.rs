use super::*;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct Notification {
  /// Review that triggered the notification.
  pub review: Review,
  /// Whether the notification has been seen.
  pub seen: bool,
  /// User ID associated with the notification.
  pub user_id: String,
}
