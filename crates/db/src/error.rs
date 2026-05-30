use super::*;

#[derive(Debug, thiserror::Error)]
pub enum Error {
  #[error("bson error: {0}")]
  Bson(#[from] bson::error::Error),
  #[error("course not found")]
  CourseNotFound,
  #[error("environment variable error: {0}")]
  Env(#[from] std::env::VarError),
  #[error("io error: {0}")]
  Io(#[from] std::io::Error),
  #[error("invalid course term: {0}")]
  InvalidCourseTerm(String),
  #[error("task join error: {0}")]
  Join(#[from] JoinError),
  #[error("json error: {0}")]
  Json(#[from] serde_json::Error),
  #[error("mongodb error: {0}")]
  MongoDB(#[from] mongodb::error::Error),
  #[error("review not found")]
  ReviewNotFound,
  #[error("integer conversion error: {0}")]
  TryFromInt(#[from] TryFromIntError),
}
