use super::*;

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct GetReviewsParams {
  /// Course ID to filter reviews by.
  pub(crate) course_id: Option<String>,
  /// Instructor name to filter reviews by.
  pub(crate) instructor_name: Option<String>,
  /// Maximum number of reviews to return.
  pub(crate) limit: Option<i64>,
  /// Number of reviews to skip.
  pub(crate) offset: Option<u64>,
  /// Whether to sort reviews by timestamp (newest first).
  pub(crate) sorted: Option<bool>,
  /// User ID to filter reviews by.
  pub(crate) user_id: Option<String>,
  /// Whether to include the unique user count in the response.
  pub(crate) with_user_count: Option<bool>,
}

impl Into<ReviewFilter> for &GetReviewsParams {
  fn into(self) -> ReviewFilter {
    ReviewFilter {
      course_id: self.course_id.clone(),
      instructor_name: self.instructor_name.clone(),
      sorted: self.sorted,
      user_id: self.user_id.clone(),
    }
  }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub(crate) struct GetReviewsPayload {
  /// List of reviews matching the query.
  pub reviews: Vec<Review>,
  /// Number of unique users who have submitted reviews (if requested).
  pub unique_user_count: Option<u32>,
}

#[utoipa::path(
  get,
  path = "/reviews",
  description = "Get a list of reviews with optional filtering.",
  params(
    ("course_id" = Option<String>, Query, description = "Course ID to filter reviews by."),
    ("instructor_name" = Option<String>, Query, description = "Instructor name to filter reviews by."),
    ("limit" = Option<i64>, Query, description = "Maximum number of reviews to return."),
    ("offset" = Option<u64>, Query, description = "Number of reviews to skip."),
    ("sorted" = Option<bool>, Query, description = "Whether to sort reviews by timestamp (newest first)."),
    ("user_id" = Option<String>, Query, description = "User ID to filter reviews by."),
    ("with_user_count" = Option<bool>, Query, description = "Whether to include the unique user count in the response."),
  ),
  responses(
    (status = StatusCode::OK, description = "List of reviews with optional metadata.", body = GetReviewsPayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
#[tracing::instrument(name = "api_get_reviews", skip(db), fields(
  course_id = %params.course_id.as_deref().unwrap_or("all"),
  instructor_name = %params.instructor_name.as_deref().unwrap_or("all"),
  limit = %params.limit.unwrap_or(50),
  offset = %params.offset.unwrap_or(0)
))]
pub(crate) async fn get_reviews(
  Query(params): Query<GetReviewsParams>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  let reviews = db
    .reviews(
      params.limit,
      params.offset,
      Some(Into::<ReviewFilter>::into(&params)),
    )
    .await?;

  let unique_user_count = if params.with_user_count.unwrap_or(false) {
    Some(db.unique_user_count().await?.try_into()?)
  } else {
    None
  };

  Ok((
    StatusCode::OK,
    Json(GetReviewsPayload {
      reviews,
      unique_user_count,
    }),
  ))
}

#[utoipa::path(
  get,
  path = "/reviews/liked",
  tag = "reviews",
  description = "Get reviews liked by the authenticated user.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  responses(
    (status = StatusCode::OK, description = "Reviews liked by the authenticated user.", body = GetReviewsPayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_liked_reviews(
  user: User,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  let user_id = user.id();
  let reviews = db.liked_reviews_for_user(&user_id).await?;

  Ok((
    StatusCode::OK,
    Json(GetReviewsPayload {
      reviews,
      unique_user_count: None,
    }),
  ))
}

#[utoipa::path(
  get,
  path = "/reviews/{id}",
  description = "Get a specific review by its ID.",
  params(
    ("id" = String, Path, description = "Review ID to get review information for.")
  ),
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  responses(
    (status = StatusCode::OK, description = "Information about a specific review.", body = Review),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  ),
)]
pub(crate) async fn get_review(
  user: User,
  Path(id): Path<String>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  Ok((StatusCode::OK, Json(db.find_review(&id, &user.id()).await?)))
}

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct AddOrUpdateReviewBody {
  /// The review content/text.
  pub(crate) content: String,
  /// Course ID this review is for.
  pub(crate) course_id: String,
  /// List of instructor names for this review.
  pub(crate) instructors: Vec<String>,
  /// Rating out of 5 (1-5).
  pub(crate) rating: u32,
  /// Difficulty rating out of 5 (1-5).
  pub(crate) difficulty: u32,
}

#[utoipa::path(
  post,
  path = "/reviews",
  description = "Add a new review for a course.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body = AddOrUpdateReviewBody,
  responses(
    (status = StatusCode::OK, description = "Review added successfully."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  ),
)]
#[tracing::instrument(name = "api_add_review", skip_all, fields(
  course_id = %body.course_id,
  rating = %body.rating
))]
pub(crate) async fn add_review(
  AppState(db): AppState<Arc<Db>>,
  user: User,
  body: Json<AddOrUpdateReviewBody>,
) -> Result<impl IntoResponse> {
  let AddOrUpdateReviewBody {
    content,
    course_id,
    instructors,
    rating,
    difficulty,
  } = body.0;

  let user_id = user.id();

  tracing::Span::current().record("user_id", tracing::field::display(&user_id));

  trace!("Adding review to database...");

  validate_instructors(db.clone(), &course_id, &instructors).await?;

  let review = Review {
    content,
    course_id: course_id.clone(),
    difficulty,
    instructors,
    rating,
    timestamp: Utc::now().into(),
    user_id,
    ..Review::default()
  };

  db.add_review(review.clone()).await?;

  info!("Adding notifications for course {}...", &course_id);

  db.add_notifications(review).await?;

  Ok(StatusCode::OK)
}

#[utoipa::path(
  put,
  path = "/reviews",
  description = "Update an existing review for a course.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body = AddOrUpdateReviewBody,
  responses(
    (status = StatusCode::OK, description = "Review updated successfully."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  ),
)]
pub(crate) async fn update_review(
  AppState(db): AppState<Arc<Db>>,
  user: User,
  body: Json<AddOrUpdateReviewBody>,
) -> Result<impl IntoResponse> {
  let AddOrUpdateReviewBody {
    content,
    course_id,
    instructors,
    rating,
    difficulty,
  } = body.0;

  validate_instructors(db.clone(), &course_id, &instructors).await?;

  trace!("Updating review...");

  let user_id = user.id();

  let review = Review {
    content,
    course_id: course_id.clone(),
    instructors,
    rating,
    difficulty,
    timestamp: Utc::now().into(),
    user_id: user_id.clone(),
    ..Review::default()
  };

  db.add_review(review.clone()).await?;

  db.update_notifications(&user_id, &course_id, review)
    .await?;

  Ok(StatusCode::OK)
}

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct DeleteReviewBody {
  /// Course ID to delete the review for.
  course_id: String,
}

#[utoipa::path(
  delete,
  path = "/reviews",
  description = "Delete a review for a specific course.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body = DeleteReviewBody,
  responses(
    (status = StatusCode::OK, description = "Review deleted successfully."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  ),
)]
pub(crate) async fn delete_review(
  AppState(db): AppState<Arc<Db>>,
  user: User,
  body: Json<DeleteReviewBody>,
) -> Result<impl IntoResponse> {
  trace!("Deleting review from the database...");

  let user_id = user.id();

  db.delete_review(&body.course_id, &user_id).await?;
  db.delete_interactions(&body.course_id, &user_id).await?;
  db.delete_notifications(&user_id, &body.course_id).await?;

  Ok(StatusCode::OK)
}

async fn validate_instructors(
  db: Arc<Db>,
  course_id: &str,
  instructors: &[String],
) -> Result {
  let course = db
    .find_course_by_id(course_id)
    .await?
    .ok_or(anyhow!("Failed to find course with id: {}", course_id))?;

  let mut valid_instructors = course
    .instructors
    .into_iter()
    .map(|ins| ins.name)
    .collect::<Vec<String>>();

  valid_instructors.push("Other".into());

  if !instructors
    .iter()
    .all(|ins| valid_instructors.contains(ins))
  {
    return Err(anyhow!("Invalid instructor(s)").into());
  }

  Ok(())
}
