use super::*;

pub(crate) type OAuthClient = BasicClient<
  EndpointSet,
  EndpointNotSet,
  EndpointNotSet,
  EndpointNotSet,
  EndpointSet,
>;

pub(crate) const COOKIE_NAME: &str = "session";

pub(crate) const MCGILL_TENANT_ID: &str =
  "cd319671-52e7-4a68-afa9-fcf8f89f09ea";

pub(crate) struct AuthRedirect;

impl IntoResponse for AuthRedirect {
  fn into_response(self) -> Response {
    Redirect::temporary("/api/auth/login").into_response()
  }
}

#[derive(Debug, Deserialize)]
pub(crate) struct AuthRequest {
  code: String,
  state: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct LoginRequest {
  redirect: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct LogoutRequest {
  redirect: String,
}

#[cfg(feature = "e2e")]
#[derive(Debug, Deserialize)]
pub(crate) struct TestLoginRequest {
  id: String,
  mail: String,
}

#[derive(Debug, Deserialize)]
#[allow(unused)]
struct AccessTokenResponse {
  access_token: String,
  expires_in: u64,
  ext_expires_in: u64,
  scope: String,
  token_type: String,
}

#[utoipa::path(
  get,
  path = "/auth/login",
  tag = "auth",
  description = "Redirect the requester to initiate the Microsoft OAuth flow.",
  params(
    ("redirect" = String, Query, description = "Absolute URL to send the user back to after sign-in completes.")
  ),
  responses(
    (status = StatusCode::SEE_OTHER, description = "Redirect to the Microsoft login page.")
  )
)]
pub(crate) async fn microsoft_auth(
  Query(query): Query<LoginRequest>,
  AppState(client): AppState<OAuthClient>,
) -> impl IntoResponse {
  Redirect::to(
    client
      .authorize_url(|| {
        CsrfToken::new(format!(
          "{}{}",
          CsrfToken::new_random().secret(),
          STANDARD.encode(query.redirect)
        ))
      })
      .add_scope(Scope::new(String::from("openid")))
      .add_scope(Scope::new(String::from("User.Read")))
      .url()
      .0
      .as_ref(),
  )
}

#[utoipa::path(
  get,
  path = "/auth/authorized",
  tag = "auth",
  description = "Complete the Microsoft OAuth flow and establish a session for the authenticated user.",
  params(
    ("code" = String, Query, description = "Authorization code issued by Microsoft."),
    ("state" = String, Query, description = "Opaque state returned by Microsoft and used for redirect validation.")
  ),
  responses(
    (status = StatusCode::SEE_OTHER, description = "Redirect to the original post-login location."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Failed to exchange the authorization code or create the session.", body = String)
  )
)]
pub(crate) async fn login_authorized(
  Query(query): Query<AuthRequest>,
  AppState(state): AppState<State>,
) -> Result<impl IntoResponse> {
  debug!("Fetching token from oauth client...");

  let redirect_uri = state
    .oauth_client
    .redirect_uri()
    .ok_or_else(|| anyhow!("Missing redirect url"))?
    .to_string();

  let params = [
    ("client_id", state.oauth_client.client_id().to_string()),
    ("client_secret", state.client_secret.clone()),
    ("code", query.code.clone()),
    ("grant_type", "authorization_code".to_string()),
    ("redirect_uri", redirect_uri),
    ("scope", "User.Read".to_string()),
  ];

  let response = state
    .request_client
    .post(format!(
      "https://login.microsoftonline.com/{MCGILL_TENANT_ID}/oauth2/v2.0/token"
    ))
    .form(&params)
    .header("Accept", "application/x-www-form-urlencoded")
    .send()
    .await?
    .json::<AccessTokenResponse>()
    .await?;

  debug!("Fetching user data from Microsoft...");

  let user: User = state
    .request_client
    .get("https://graph.microsoft.com/v1.0/me")
    .bearer_auth(response.access_token)
    .send()
    .await?
    .json()
    .await?;

  let url =
    Url::parse(&String::from_utf8(STANDARD.decode(&query.state[22..])?)?)?;

  let mut session = Session::new();

  session.expire_in(Duration::from_secs(60 * 60 * 24 * 7));

  debug!("Inserting user data into session...");

  session.insert("user", user)?;

  let mut headers = HeaderMap::new();

  headers.insert(
    SET_COOKIE,
    format!(
      "{}={}; SameSite=Lax; Path=/",
      COOKIE_NAME,
      state
        .session_store
        .store_session(session)
        .await?
        .ok_or(anyhow!("Failed to store session"))?
    )
    .parse()?,
  );

  Ok((headers, Redirect::to(url.as_ref())))
}

#[utoipa::path(
  get,
  path = "/auth/logout",
  tag = "auth",
  description = "Invalidate the current session and redirect the user back to the client.",
  params(
    ("redirect" = String, Query, description = "Absolute URL to send the user to after logout.")
  ),
  responses(
    (status = StatusCode::SEE_OTHER, description = "Redirect to the requested post-logout location."),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Failed to destroy the session.", body = String)
  )
)]
pub(crate) async fn logout(
  Query(query): Query<LogoutRequest>,
  TypedHeader(cookies): TypedHeader<Cookie>,
  AppState(session_store): AppState<MongodbSessionStore>,
) -> Result<impl IntoResponse> {
  let cookie = match cookies.get(COOKIE_NAME) {
    Some(c) => c,
    None => return Ok(Redirect::to(&query.redirect)),
  };

  let session = match session_store.load_session(cookie.to_string()).await? {
    Some(s) => s,
    None => return Ok(Redirect::to(&query.redirect)),
  };

  debug!("Destroying session...");

  session_store.destroy_session(session).await?;

  Ok(Redirect::to(&query.redirect))
}

#[cfg(feature = "e2e")]
pub(crate) async fn test_login(
  AppState(session_store): AppState<MongodbSessionStore>,
  Json(body): Json<TestLoginRequest>,
) -> Result<impl IntoResponse> {
  let mut session = Session::new();

  session.expire_in(Duration::from_secs(60 * 60));
  session.insert("user", User::new(&body.id, &body.mail))?;

  let mut headers = HeaderMap::new();

  headers.insert(
    SET_COOKIE,
    format!(
      "{}={}; SameSite=Lax; Path=/",
      COOKIE_NAME,
      session_store
        .store_session(session)
        .await?
        .ok_or(anyhow!("Failed to store session"))?
    )
    .parse()?,
  );

  Ok((headers, StatusCode::NO_CONTENT))
}
