use super::*;

#[derive(Deserialize, ToSchema)]
pub(crate) struct GetCourseAveragesParams {
  course_id: Option<String>,
}

#[utoipa::path(
  get,
  path = "/course-averages",
  tag = "course-averages",
  description = "Get course grade averages by term.",
  params(
    (
      "course_id" = Option<String>,
      Query,
      description = "Filter by course ID.",
      example = "COMP202"
    ),
  ),
  responses(
    (status = StatusCode::OK, description = "Course averages.", body = Vec<CourseAverage>),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_course_averages(
  Query(params): Query<GetCourseAveragesParams>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  Ok((
    StatusCode::OK,
    Json(db.course_averages(params.course_id.as_deref()).await?),
  ))
}
