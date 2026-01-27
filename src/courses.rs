use super::*;

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GetCoursesParams {
  #[serde(flatten)]
  filter: CourseFilter,
  limit: Option<i64>,
  offset: Option<u64>,
  with_course_count: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub(crate) struct GetCoursesPayload {
  /// Total number of courses available (if requested).
  pub(crate) course_count: Option<u32>,
  /// List of courses matching the query.
  pub(crate) courses: Vec<Course>,
}

#[utoipa::path(
  get,
  path = "/courses",
  description = "Get a list of courses with optional filtering.",
  params(
    (
      "levels" = Option<String>,
      Query,
      description = "Comma-separated list of course levels to filter by.",
      example = "2,3,4"
    ),
    (
      "limit" = Option<i64>,
      Query,
      description = "Maximum number of courses to return.",
      minimum = 0,
      example = 20
    ),
    (
      "offset" = Option<u64>,
      Query,
      description = "Number of courses to skip for pagination.",
      minimum = 0,
      example = 0
    ),
    (
      "query" = Option<String>,
      Query,
      description = "Search query string to filter courses by title, description, or ID.",
      example = "algorithms"
    ),
    (
      "sortReverse" = Option<bool>,
      Query,
      description = "Whether to reverse the sort order. When true, sorts descending (highest first).",
      example = true
    ),
    (
      "sortType" = Option<CourseSortType>,
      Query,
      description = "Field to sort results by."
    ),
    (
      "subjects" = Option<String>,
      Query,
      description = "Comma-separated list of subject codes to filter by.",
      example = "COMP,MATH"
    ),
    (
      "terms" = Option<String>,
      Query,
      description = "Comma-separated list of terms to filter by.",
      example = "Fall 2024,Winter 2025"
    ),
    (
      "with_course_count" = Option<bool>,
      Query,
      description = "Whether to include the total course count in the response.",
      example = true
    ),
  ),
  responses(
    (status = StatusCode::OK, description = "Information about many courses.", body = GetCoursesPayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_courses(
  Query(params): Query<GetCoursesParams>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  let courses = db
    .courses(params.limit, params.offset, Some(params.filter))
    .await?;

  let course_count = if params.with_course_count.unwrap_or(false) {
    Some(db.course_count().await?.try_into()?)
  } else {
    None
  };

  Ok((
    StatusCode::OK,
    Json(GetCoursesPayload {
      course_count,
      courses,
    }),
  ))
}

#[derive(Debug, Deserialize, ToSchema)]
pub(crate) struct GetCourseByIdParams {
  /// Whether to include reviews in the response.
  with_reviews: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub(crate) struct GetCourseByIdPayload {
  /// The course information.
  pub(crate) course: Course,
  /// Reviews for the course (sorted by timestamp, newest first).
  pub(crate) reviews: Vec<Review>,
}

#[utoipa::path(
  get,
  path = "/courses/{id}",
  description = "Get information about a specific course by its ID.",
  params(
    ("id" = String, Path, description = "Course ID to get course information for."),
    ("with_reviews" = Option<bool>, Query, description = "Whether to include reviews in the response."),
  ),
  responses(
    (status = StatusCode::OK, description = "Information about a specific course.", body = GetCourseByIdPayload),
    (status = StatusCode::NOT_FOUND, description = "Course not found."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_course_by_id(
  Path(id): Path<String>,
  Query(params): Query<GetCourseByIdParams>,
  AppState(state): AppState<State>,
) -> Result<impl IntoResponse> {
  Ok(match state.db.find_course_by_id(&id).await? {
    Some(course) => {
      let mut reviews = params
        .with_reviews
        .unwrap_or(false)
        .then_some(state.db.find_reviews_by_course_id(&id).await?);

      if let Some(ref mut reviews) = reviews {
        reviews.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        return Ok((
          StatusCode::OK,
          Json(Some(GetCourseByIdPayload {
            course,
            reviews: reviews.to_vec(),
          })),
        ));
      }

      (
        StatusCode::OK,
        Json(Some(GetCourseByIdPayload {
          course,
          reviews: vec![],
        })),
      )
    }
    None => (StatusCode::NOT_FOUND, Json(None)),
  })
}
