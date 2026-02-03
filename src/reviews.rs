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
  description = "Get a list of reviews with optional filtering by course, instructor, or user.",
  params(
    (
      "course_id" = Option<String>,
      Query,
      description = "Course ID to filter reviews by (e.g., COMP202).",
      example = "COMP202"
    ),
    (
      "instructor_name" = Option<String>,
      Query,
      description = "Instructor name to filter reviews by. Must match exactly.",
      example = "Jonathan Campbell"
    ),
    (
      "limit" = Option<i64>,
      Query,
      description = "Maximum number of reviews to return.",
      minimum = 0,
      example = 20
    ),
    (
      "offset" = Option<u64>,
      Query,
      description = "Number of reviews to skip for pagination.",
      minimum = 0,
      example = 0
    ),
    (
      "sorted" = Option<bool>,
      Query,
      description = "Whether to sort reviews by timestamp (newest first).",
      example = true
    ),
    (
      "user_id" = Option<String>,
      Query,
      description = "User ID to filter reviews by."
    ),
    (
      "with_user_count" = Option<bool>,
      Query,
      description = "Whether to include the count of unique users who have submitted reviews.",
      example = true
    ),
  ),
  responses(
    (
      status = StatusCode::OK,
      description = "Reviews matching the filter criteria.",
      body = GetReviewsPayload,
      content_type = "application/json"
    ),
    (
      status = StatusCode::INTERNAL_SERVER_ERROR,
      description = "Internal server error.",
      body = String,
      content_type = "text/plain"
    )
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
  description = "Get all reviews that the authenticated user has liked. Returns a list of full review objects. Requires authentication.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  responses(
    (
      status = StatusCode::OK,
      description = "Reviews liked by the authenticated user. The unique_user_count field is always null for this endpoint.",
      body = GetReviewsPayload,
      content_type = "application/json"
    ),
    (
      status = StatusCode::UNAUTHORIZED,
      description = "User is not authenticated.",
      content_type = "text/plain"
    ),
    (
      status = StatusCode::INTERNAL_SERVER_ERROR,
      description = "Internal server error.",
      body = String,
      content_type = "text/plain"
    )
  )
)]
pub(crate) async fn get_liked_reviews(
  user: User,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  Ok((
    StatusCode::OK,
    Json(GetReviewsPayload {
      reviews: db.liked_reviews_for_user(&user.id()).await?,
      unique_user_count: None,
    }),
  ))
}

#[utoipa::path(
  get,
  path = "/reviews/{id}",
  description = "Get a specific review by its unique identifier. The review includes interaction data (likes) specific to the authenticated user.",
  params(
    (
      "id" = String,
      Path,
      description = "Unique review identifier. This is a MongoDB ObjectId string.",
      example = "507f1f77bcf86cd799439011"
    )
  ),
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  responses(
    (
      status = StatusCode::OK,
      description = "The requested review with user-specific interaction data.",
      body = Review,
      content_type = "application/json"
    ),
    (
      status = StatusCode::NOT_FOUND,
      description = "Review with the specified ID was not found.",
      content_type = "text/plain"
    ),
    (
      status = StatusCode::UNAUTHORIZED,
      description = "User is not authenticated.",
      content_type = "text/plain"
    ),
    (
      status = StatusCode::INTERNAL_SERVER_ERROR,
      description = "Internal server error.",
      body = String,
      content_type = "text/plain"
    )
  )
)]
pub(crate) async fn get_review(
  user: User,
  Path(id): Path<String>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  Ok((StatusCode::OK, Json(db.find_review(&id, &user.id()).await?)))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct AddOrUpdateReviewBody {
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
  description = "Add a new review for a course. A user can only have one review per course. Instructors must be valid for the course or 'Other'. Creates notifications for users subscribed to the course.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body(
    content = AddOrUpdateReviewBody,
    description = "Review data including course ID, rating, difficulty, instructors, and content.",
    content_type = "application/json"
  ),
  responses(
    (
      status = StatusCode::OK,
      description = "Review added successfully."
    ),
    (
      status = StatusCode::UNAUTHORIZED,
      description = "User is not authenticated.",
      content_type = "text/plain"
    ),
    (
      status = StatusCode::INTERNAL_SERVER_ERROR,
      description = "Internal server error.",
      body = String,
      content_type = "text/plain"
    )
  )
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
  description = "Update an existing review for a course. The review is identified by the authenticated user's ID and the course ID. Updates the timestamp and associated notifications.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body(
    content = AddOrUpdateReviewBody,
    description = "Updated review data. All fields are required even if unchanged.",
    content_type = "application/json"
  ),
  responses(
    (
      status = StatusCode::OK,
      description = "Review updated successfully."
    ),
    (
      status = StatusCode::UNAUTHORIZED,
      description = "User is not authenticated.",
      content_type = "text/plain"
    ),
    (
      status = StatusCode::INTERNAL_SERVER_ERROR,
      description = "Internal server error.",
      body = String,
      content_type = "text/plain"
    )
  )
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
  description = "Delete a review for a specific course. Also removes all associated interactions (likes) and notifications. The review is identified by the authenticated user's ID and the course ID.",
  security(
    ("microsoftOAuth" = ["User.Read"])
  ),
  request_body(
    content = DeleteReviewBody,
    description = "The course ID of the review to delete.",
    content_type = "application/json"
  ),
  responses(
    (
      status = StatusCode::OK,
      description = "Review and associated data deleted successfully."
    ),
    (
      status = StatusCode::UNAUTHORIZED,
      description = "User is not authenticated.",
      content_type = "text/plain"
    ),
    (
      status = StatusCode::INTERNAL_SERVER_ERROR,
      description = "Internal server error.",
      body = String,
      content_type = "text/plain"
    )
  )
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
    .map(|instructor| instructor.name)
    .collect::<Vec<String>>();

  valid_instructors.push("Other".into());

  if !instructors
    .iter()
    .all(|instructor| valid_instructors.contains(instructor))
  {
    return Err(anyhow!("Invalid instructor(s)").into());
  }

  Ok(())
}
