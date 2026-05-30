use super::*;

#[utoipa::path(
  get,
  path = "/subscriptions",
  description = "Get all subscriptions for the authenticated user.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  responses(
    (status = StatusCode::OK, description = "List of subscriptions for the user.", body = Vec<Subscription>),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_subscriptions(
  user: User,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  Ok(Json(db.get_subscriptions(&user.id()).await?))
}

#[utoipa::path(
  get,
  path = "/subscriptions/{course_id}",
  description = "Get a specific subscription for the authenticated user.",
  params(
    ("course_id" = String, Path, description = "Course ID to fetch a subscription for.")
  ),
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  responses(
    (status = StatusCode::OK, description = "The requested subscription, or `null` if not found.", body = Option<Subscription>),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_subscription(
  user: User,
  Path(course_id): Path<String>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  Ok(Json(db.get_subscription(&user.id(), &course_id).await?))
}

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct AddOrDeleteSubscriptionBody {
  /// Course ID to subscribe to or unsubscribe from.
  course_id: String,
}

#[utoipa::path(
  post,
  path = "/subscriptions",
  description = "Add a subscription for the authenticated user.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body = AddOrDeleteSubscriptionBody,
  responses(
    (status = StatusCode::OK, description = "Subscription created successfully.", body = serde_json::Value),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn add_subscription(
  user: User,
  AppState(db): AppState<Arc<Db>>,
  body: Json<AddOrDeleteSubscriptionBody>,
) -> Result<impl IntoResponse> {
  let user_id = user.id();

  info!(
    "Adding subscription for user {} to course {}",
    &user_id, body.course_id
  );

  Ok(Json(
    db.add_subscription(Subscription {
      user_id,
      course_id: body.course_id.clone(),
    })
    .await?,
  ))
}

#[utoipa::path(
  delete,
  path = "/subscriptions",
  description = "Delete a subscription for the authenticated user.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body = AddOrDeleteSubscriptionBody,
  responses(
    (status = StatusCode::OK, description = "Subscription deleted successfully.", body = serde_json::Value),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn delete_subscription(
  user: User,
  AppState(db): AppState<Arc<Db>>,
  body: Json<AddOrDeleteSubscriptionBody>,
) -> Result<impl IntoResponse> {
  let user_id = user.id();

  info!(
    "Removing subscription for user {} to course {}",
    &user_id, body.course_id
  );

  db.purge_notifications(&user_id, &body.course_id).await?;

  Ok(Json(
    db.delete_subscription(Subscription {
      user_id,
      course_id: body.course_id.clone(),
    })
    .await?,
  ))
}
