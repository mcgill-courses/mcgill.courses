use super::*;

const ADMINS: &[&str] = &["c89e21e2-11be-4eb9-b8f7-b4fcd2851e59"];

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub(crate) struct User {
  /// Microsoft Graph user identifier.
  id: String,
  /// Primary email address associated with the user.
  mail: String,
}

impl<S> OptionalFromRequestParts<S> for User
where
  MongodbSessionStore: FromRef<S>,
  S: Send + Sync,
{
  type Rejection = Infallible;

  async fn from_request_parts(
    parts: &mut Parts,
    state: &S,
  ) -> Result<Option<Self>, Self::Rejection> {
    match <User as FromRequestParts<S>>::from_request_parts(parts, state).await
    {
      Ok(res) => Ok(Some(res)),
      Err(AuthRedirect) => Ok(None),
    }
  }
}

impl<S> FromRequestParts<S> for User
where
  MongodbSessionStore: FromRef<S>,
  S: Send + Sync,
{
  type Rejection = AuthRedirect;

  async fn from_request_parts(
    parts: &mut Parts,
    state: &S,
  ) -> Result<Self, Self::Rejection> {
    let session_store = MongodbSessionStore::from_ref(state);

    let cookies = parts.extract::<TypedHeader<Cookie>>().await.map_err(
      |error| match *error.name() {
        header::COOKIE => match error.reason() {
          TypedHeaderRejectionReason::Missing => AuthRedirect,
          _ => {
            error!("Unexpected error getting cookie header(s): {error}");
            AuthRedirect
          }
        },
        _ => {
          error!("Unexpected error getting cookies: {error}");
          AuthRedirect
        }
      },
    )?;

    session_store
      .load_session(cookies.get(COOKIE_NAME).ok_or(AuthRedirect)?.to_owned())
      .await
      .unwrap()
      .ok_or(AuthRedirect)?
      .get::<User>("user")
      .ok_or(AuthRedirect)
  }
}

impl User {
  pub(crate) fn id(self) -> String {
    self.id
  }

  pub(crate) fn is_admin(&self) -> bool {
    ADMINS.contains(&self.id.as_str())
  }

  #[cfg(test)]
  pub(crate) fn new(id: &str, mail: &str) -> Self {
    User {
      id: String::from(id),
      mail: String::from(mail),
    }
  }
}

#[derive(Serialize, Deserialize, ToSchema)]
#[typeshare]
pub(crate) struct UserResponse {
  /// Authenticated user information when available.
  pub(crate) user: Option<User>,
}

#[utoipa::path(
  get,
  path = "/user",
  description = "Get information about the currently authenticated user, if any.",
  responses(
    (
      status = StatusCode::OK,
      description = "Authenticated user details or `null` when the requester is not signed in.",
      body = UserResponse
    )
  )
)]
pub(crate) async fn get_user(user: Option<User>) -> impl IntoResponse {
  Json(UserResponse { user })
}
