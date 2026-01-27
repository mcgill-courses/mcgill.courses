use super::*;

#[derive(Deserialize, ToSchema)]
pub(crate) struct GetAveragesParams {
  course_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub(crate) struct GetAveragesPayload {
  pub averages: Vec<model::CourseAverage>,
}

#[utoipa::path(
  get,
  path = "/averages",
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
    (status = StatusCode::OK, description = "Course averages.", body = GetAveragesPayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_averages(
  Query(params): Query<GetAveragesParams>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  let averages = db.averages(params.course_id.as_deref()).await?;

  Ok((StatusCode::OK, Json(GetAveragesPayload { averages })))
}
