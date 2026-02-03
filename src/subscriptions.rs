use super::*;

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct GetSubscriptionParams {
  /// Course ID to fetch a subscription for.
  course_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(untagged)]
pub(crate) enum SubscriptionResponse {
  /// Single subscription (or `null` if not found).
  Single(Option<Subscription>),
  /// List of subscriptions for the authenticated user.
  Multiple(Vec<Subscription>),
}

#[utoipa::path(
  get,
  path = "/subscriptions",
  description = "Get subscriptions for the authenticated user.",
  params(
    ("course_id" = Option<String>, Query, description = "Course ID to fetch a specific subscription for.")
  ),
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  responses(
    (status = StatusCode::OK, description = "Subscription information for the user.", body = SubscriptionResponse),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_subscription(
  user: User,
  AppState(db): AppState<Arc<Db>>,
  params: Query<GetSubscriptionParams>,
) -> Result<impl IntoResponse> {
  Ok(Json(match &params.course_id {
    Some(course_id) => SubscriptionResponse::Single(
      db.get_subscription(&user.id(), course_id).await?,
    ),
    None => {
      SubscriptionResponse::Multiple(db.get_subscriptions(&user.id()).await?)
    }
  }))
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
