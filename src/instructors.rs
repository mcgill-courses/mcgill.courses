use super::*;

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[typeshare]
pub(crate) struct GetInstructorPayload {
  /// Instructor matching the requested name, if found.
  pub(crate) instructor: Option<Instructor>,
  /// Reviews associated with the instructor sorted by newest first.
  pub(crate) reviews: Vec<Review>,
  pub(crate) courses: Vec<Course>,
}

#[utoipa::path(
  get,
  path = "/instructors/{name}",
  description = "Get information about an instructor along with their reviews.",
  params(
    ("name" = String, Path, description = "Instructor name to retrieve information for.")
  ),
  responses(
    (status = StatusCode::OK, description = "Instructor information with associated reviews.", body = GetInstructorPayload),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Internal server error.", body = String)
  )
)]
pub(crate) async fn get_instructor(
  Path(name): Path<String>,
  AppState(db): AppState<Arc<Db>>,
) -> Result<impl IntoResponse> {
  info!("Fetching instructor for name: {name}");

  let instructor = db.find_instructor_by_name(&name).await?;

  Ok(Json(GetInstructorPayload {
    instructor: instructor.clone(),
    reviews: match &instructor {
      Some(ins) => {
        let mut reviews = db.find_reviews_by_instructor_name(&ins.name).await?;
        reviews.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        reviews
      }
      None => vec![],
    },
    courses: match &instructor {
      Some(ins) => db.find_courses_by_instructor_name(&ins.name).await?,
      None => vec![],
    },
  }))
}
