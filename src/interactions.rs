use super::*;

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct GetInteractionKindParams {
  /// Course ID to get the interaction for.
  pub(crate) course_id: String,
  /// User ID of the review author.
  pub(crate) user_id: String,
}

#[derive(Debug, Deserialize, Serialize, PartialEq, ToSchema)]
#[typeshare]
pub(crate) struct GetInteractionKindPayload {
  /// Interaction the user has taken for this course and referrer, if any.
  pub(crate) kind: Option<InteractionKind>,
}

#[utoipa::path(
  get,
  path = "/interactions",
  tag = "interactions",
  description = "Retrieve the authenticated user's interaction kind for a review.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  params(
    ("course_id" = String, Query, description = "Course ID to get the interaction for."),
    ("user_id" = String, Query, description = "User ID of the review author."),
  ),
  responses(
    (status = StatusCode::OK, description = "Authenticated user's interaction kind for the requested review.", body = GetInteractionKindPayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_interaction_kind(
  params: Query<GetInteractionKindParams>,
  AppState(db): AppState<Arc<Db>>,
  user: User,
) -> Result<impl IntoResponse> {
  let referrer = user.id();
  let kind = db
    .interaction_kind(&params.course_id, &params.user_id, &referrer)
    .await?;

  Ok(Json(GetInteractionKindPayload { kind }))
}

#[derive(Debug, Deserialize, Serialize, PartialEq, ToSchema)]
#[typeshare]
pub(crate) struct GetUserInteractionForCoursePayload {
  /// Course ID the interactions belong to.
  pub(crate) course_id: String,
  /// Authenticated user ID the interactions belong to.
  pub(crate) referrer: String,
  /// Authenticated user's interactions for the course.
  pub(crate) interactions: Vec<Interaction>,
}

#[utoipa::path(
  get,
  path = "/interactions/{course_id}",
  tag = "interactions",
  description = "Get the authenticated user's interactions for a course.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  params(
    ("course_id" = String, Path, description = "Course ID to get interactions for.")
  ),
  responses(
    (status = StatusCode::OK, description = "Authenticated user's interactions for the requested course.", body = GetUserInteractionForCoursePayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_user_interactions_for_course(
  Path(course_id): Path<String>,
  AppState(db): AppState<Arc<Db>>,
  user: User,
) -> Result<impl IntoResponse> {
  let referrer = user.id();
  info!("Fetching review interactions from {referrer} for course {course_id}",);

  Ok(Json(GetUserInteractionForCoursePayload {
    course_id: course_id.clone(),
    referrer: referrer.clone(),
    interactions: db
      .user_interactions_for_course(&course_id, &referrer)
      .await?,
  }))
}

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct AddInteractionBody {
  /// Kind of interaction to record.
  pub(crate) kind: InteractionKind,
  /// Course ID the interaction is for.
  pub(crate) course_id: String,
  /// User ID of the review author.
  pub(crate) user_id: String,
}

#[utoipa::path(
  post,
  path = "/interactions",
  tag = "interactions",
  description = "Record a new interaction for a course.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body = AddInteractionBody,
  responses(
    (status = StatusCode::OK, description = "Interaction recorded successfully."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn add_interaction(
  AppState(db): AppState<Arc<Db>>,
  user: User,
  body: Json<AddInteractionBody>,
) -> Result<impl IntoResponse> {
  info!(
    "Adding interaction for review {}/{}...",
    body.course_id, body.user_id
  );

  db.add_interaction(Interaction {
    kind: body.kind.clone(),
    course_id: body.course_id.clone(),
    user_id: body.user_id.clone(),
    referrer: user.id(),
  })
  .await
  .map_err(|error| match error {
    db::Error::ReviewNotFound => Error::not_found("review not found"),
    other => other.into(),
  })?;

  Ok(())
}

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct DeleteInteractionBody {
  /// Course ID the interaction belongs to.
  pub(crate) course_id: String,
  /// User ID of the review author.
  pub(crate) user_id: String,
}

#[utoipa::path(
  delete,
  path = "/interactions",
  tag = "interactions",
  description = "Remove an interaction for a course.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body = DeleteInteractionBody,
  responses(
    (status = StatusCode::OK, description = "Interaction removed successfully."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn delete_interaction(
  AppState(db): AppState<Arc<Db>>,
  user: User,
  body: Json<DeleteInteractionBody>,
) -> Result<impl IntoResponse> {
  info!(
    "Removing interaction for review {}/{}...",
    body.course_id, body.user_id
  );

  db.delete_interaction(&body.course_id, &body.user_id, &user.id())
    .await?;

  Ok(())
}
