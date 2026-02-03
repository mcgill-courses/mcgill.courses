use super::*;

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct GetInteractionKindParams {
  /// Course ID to get the interaction for.
  pub(crate) course_id: String,
  /// User ID associated with the interaction.
  pub(crate) user_id: String,
  /// Referrer source for the interaction.
  pub(crate) referrer: String,
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
  description = "Retrieve the interaction kind a user has taken on a course for a specific referrer.",
  params(
    ("course_id" = String, Query, description = "Course ID to get the interaction for."),
    ("user_id" = String, Query, description = "User ID associated with the interaction."),
    ("referrer" = String, Query, description = "Referrer source for the interaction."),
  ),
  responses(
    (status = StatusCode::OK, description = "Interaction kind for the requested course, user, and referrer.", body = GetInteractionKindPayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_interaction_kind(
  params: Query<GetInteractionKindParams>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  let kind = db
    .interaction_kind(&params.course_id, &params.user_id, &params.referrer)
    .await?;

  Ok(Json(GetInteractionKindPayload { kind }))
}

#[derive(Debug, Deserialize, Serialize, PartialEq, ToSchema)]
#[typeshare]
pub(crate) struct GetUserInteractionForCoursePayload {
  /// Course ID the interactions belong to.
  pub(crate) course_id: String,
  /// Referrer source the interactions were recorded from.
  pub(crate) referrer: String,
  /// Interactions recorded for the course and referrer.
  pub(crate) interactions: Vec<Interaction>,
}

#[utoipa::path(
  get,
  path = "/interactions/{course_id}/referrer/{referrer}",
  tag = "interactions",
  description = "Get all interactions for a course filtered by referrer.",
  params(
    ("course_id" = String, Path, description = "Course ID to get interactions for."),
    ("referrer" = String, Path, description = "Referrer source to filter interactions by.")
  ),
  responses(
    (status = StatusCode::OK, description = "Interactions for the requested course and referrer.", body = GetUserInteractionForCoursePayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_user_interactions_for_course(
  Path((course_id, referrer)): Path<(String, String)>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
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
  /// User ID creating the interaction.
  pub(crate) user_id: String,
  /// Referrer source associated with the interaction.
  pub(crate) referrer: String,
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
  _user: User,
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
    referrer: body.referrer.clone(),
  })
  .await?;

  Ok(())
}

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct DeleteInteractionBody {
  /// Course ID the interaction belongs to.
  pub(crate) course_id: String,
  /// User ID associated with the interaction.
  pub(crate) user_id: String,
  /// Referrer source to remove the interaction for.
  pub(crate) referrer: String,
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
  _user: User,
  body: Json<DeleteInteractionBody>,
) -> Result<impl IntoResponse> {
  info!(
    "Removing interaction for review {}/{}...",
    body.course_id, body.user_id
  );

  db.delete_interaction(&body.course_id, &body.user_id, &body.referrer)
    .await?;

  Ok(())
}
