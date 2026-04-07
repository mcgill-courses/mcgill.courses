use super::*;

#[derive(Debug)]
pub(crate) enum Error {
  BadRequest(String),
  NotFound(String),
  Internal(anyhow::Error),
}

impl Error {
  pub(crate) fn bad_request(message: impl Into<String>) -> Self {
    Self::BadRequest(message.into())
  }

  pub(crate) fn not_found(message: impl Into<String>) -> Self {
    Self::NotFound(message.into())
  }

  fn status(&self) -> StatusCode {
    match self {
      Self::BadRequest(_) => StatusCode::BAD_REQUEST,
      Self::NotFound(_) => StatusCode::NOT_FOUND,
      Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
  }

  fn public_message(&self) -> &str {
    match self {
      Self::BadRequest(message) | Self::NotFound(message) => message,
      Self::Internal(_) => "internal server error",
    }
  }
}

impl Display for Error {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    match self {
      Self::Internal(error) => write!(f, "{error}"),
      _ => write!(f, "{}", self.public_message()),
    }
  }
}

impl<E> From<E> for Error
where
  E: Into<anyhow::Error>,
{
  fn from(err: E) -> Self {
    Self::Internal(err.into())
  }
}

#[derive(Serialize)]
struct ErrorBody<'a> {
  error: &'a str,
  status: u16,
}

impl IntoResponse for Error {
  fn into_response(self) -> Response {
    let status = self.status();

    if let Self::Internal(error) = &self {
      error!("internal error: {error:?}");
    }

    let body = ErrorBody {
      error: self.public_message(),
      status: status.as_u16(),
    };

    (status, Json(body)).into_response()
  }
}
