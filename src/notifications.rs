use super::*;

#[utoipa::path(
  get,
  path = "/notifications",
  tag = "notifications",
  description = "Get the current user's notifications.",
  security(("microsoftOAuth" = ["User.Read"])),
  responses(
    (status = StatusCode::OK, description = "Notifications for the authenticated user, sorted by recency.", body = [Notification]),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_notifications(
  user: User,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  let mut notifications = db.get_notifications(&user.id()).await?;
  notifications.sort_by(|a, b| b.review.timestamp.cmp(&a.review.timestamp));
  Ok((StatusCode::OK, Json(notifications)))
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub(crate) struct UpdateNotificationBody {
  /// Identifier of the course associated with the notification.
  pub(crate) course_id: String,
  /// Identifier of the user who created the notification's review.
  pub(crate) creator_id: String,
  /// Whether the notification has been marked as seen.
  pub(crate) seen: bool,
}

#[utoipa::path(
  put,
  path = "/notifications",
  tag = "notifications",
  description = "Mark a notification as seen or unseen.",
  security(("microsoftOAuth" = ["User.Read"])),
  request_body = UpdateNotificationBody,
  responses(
    (status = StatusCode::OK, description = "Notification updated successfully."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn update_notification(
  user: User,
  AppState(db): AppState<Arc<Db>>,
  body: Json<UpdateNotificationBody>,
) -> Result<impl IntoResponse> {
  db.update_notification(
    &user.id(),
    &body.course_id,
    &body.creator_id,
    body.seen,
  )
  .await?;

  Ok(StatusCode::OK)
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub(crate) struct DeleteNotificationBody {
  /// Identifier of the course whose notification should be removed.
  pub(crate) course_id: String,
  /// Identifier of the user who created the notification's review.
  pub(crate) user_id: String,
}

#[utoipa::path(
  delete,
  path = "/notifications",
  tag = "notifications",
  description = "Delete a notification for the current user.",
  security(("microsoftOAuth" = ["User.Read"])),
  request_body = DeleteNotificationBody,
  responses(
    (status = StatusCode::OK, description = "Notification deleted successfully."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn delete_notification(
  user: User,
  AppState(db): AppState<Arc<Db>>,
  body: Json<DeleteNotificationBody>,
) -> Result<impl IntoResponse> {
  db.delete_notification(&user.id(), &body.course_id, &body.user_id)
    .await?;
  Ok(StatusCode::OK)
}
