use super::*;

pub(crate) type OAuthClient = BasicClient<
  EndpointSet,
  EndpointNotSet,
  EndpointNotSet,
  EndpointNotSet,
  EndpointSet,
>;

pub(crate) const COOKIE_NAME: &str = "session";
const OAUTH_COOKIE_NAME: &str = "oauth-flow";
const OAUTH_FLOW_DURATION: Duration = Duration::from_secs(10 * 60);

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

#[derive(Debug, Deserialize, Serialize)]
struct OAuthFlow {
  pkce_verifier: String,
  redirect: String,
  state: String,
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
    ("redirect" = String, Query, description = "Relative path to send the user back to after sign-in completes.")
  ),
  responses(
    (status = StatusCode::SEE_OTHER, description = "Redirect to the Microsoft login page."),
    (status = StatusCode::BAD_REQUEST, description = "The post-login redirect is not a relative path.", body = String)
  )
)]
pub(crate) async fn microsoft_auth(
  Query(query): Query<LoginRequest>,
  AppState(state): AppState<State>,
) -> Result<impl IntoResponse> {
  let redirect = validate_redirect(&query.redirect)?.to_string();
  let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
  let (authorize_url, csrf_token) = state
    .oauth_client
    .authorize_url(CsrfToken::new_random)
    .add_scope(Scope::new(String::from("openid")))
    .add_scope(Scope::new(String::from("User.Read")))
    .set_pkce_challenge(pkce_challenge)
    .url();

  let mut session = Session::new();

  session.expire_in(OAUTH_FLOW_DURATION);
  session.insert(
    "oauth_flow",
    OAuthFlow {
      pkce_verifier: pkce_verifier.secret().to_string(),
      redirect,
      state: csrf_token.secret().to_string(),
    },
  )?;

  let cookie = state
    .session_store
    .store_session(session)
    .await?
    .ok_or(anyhow!("Failed to store OAuth flow"))?;
  let mut headers = HeaderMap::new();

  headers.insert(
    SET_COOKIE,
    format!(
      "{OAUTH_COOKIE_NAME}={cookie}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age={}{}",
      OAUTH_FLOW_DURATION.as_secs(),
      secure_cookie_attribute(&state.oauth_client),
    )
    .parse()?,
  );

  Ok((headers, Redirect::to(authorize_url.as_ref())))
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
    (status = StatusCode::BAD_REQUEST, description = "The OAuth state is invalid or expired.", body = String),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Failed to exchange the authorization code or create the session.", body = String)
  )
)]
pub(crate) async fn login_authorized(
  Query(query): Query<AuthRequest>,
  TypedHeader(cookies): TypedHeader<Cookie>,
  AppState(state): AppState<State>,
) -> Result<impl IntoResponse> {
  let cookie = cookies
    .get(OAUTH_COOKIE_NAME)
    .ok_or_else(|| Error::bad_request("Invalid OAuth state"))?;
  let session = state
    .session_store
    .load_session(cookie.to_string())
    .await?
    .ok_or_else(|| Error::bad_request("Invalid OAuth state"))?;
  let flow = session
    .get::<OAuthFlow>("oauth_flow")
    .ok_or_else(|| Error::bad_request("Invalid OAuth state"))?;

  if flow.state != query.state {
    return Err(Error::bad_request("Invalid OAuth state"));
  }

  let redirect = validate_redirect(&flow.redirect)?.to_string();

  state.session_store.destroy_session(session).await?;

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
    ("code_verifier", flow.pkce_verifier),
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

  let mut session = Session::new();

  session.expire_in(Duration::from_secs(60 * 60 * 24 * 7));

  debug!("Inserting user data into session...");

  session.insert("user", user)?;

  let mut headers = HeaderMap::new();

  headers.insert(
    SET_COOKIE,
    format!(
      "{}={}; HttpOnly; SameSite=Lax; Path=/{}",
      COOKIE_NAME,
      state
        .session_store
        .store_session(session)
        .await?
        .ok_or(anyhow!("Failed to store session"))?,
      secure_cookie_attribute(&state.oauth_client),
    )
    .parse()?,
  );

  headers.append(
    SET_COOKIE,
    format!(
      "{OAUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0{}",
      secure_cookie_attribute(&state.oauth_client),
    )
    .parse()?,
  );

  Ok((headers, Redirect::to(&redirect)))
}

#[utoipa::path(
  get,
  path = "/auth/logout",
  tag = "auth",
  description = "Invalidate the current session and redirect the user back to the client.",
  params(
    ("redirect" = String, Query, description = "Relative path to send the user to after logout.")
  ),
  responses(
    (status = StatusCode::SEE_OTHER, description = "Redirect to the requested post-logout location."),
    (status = StatusCode::BAD_REQUEST, description = "The post-logout redirect is not a relative path.", body = String),
    (status = StatusCode::INTERNAL_SERVER_ERROR, description = "Failed to destroy the session.", body = String)
  )
)]
pub(crate) async fn logout(
  Query(query): Query<LogoutRequest>,
  TypedHeader(cookies): TypedHeader<Cookie>,
  AppState(session_store): AppState<MongodbSessionStore>,
) -> Result<impl IntoResponse> {
  let redirect = validate_redirect(&query.redirect)?;

  let cookie = match cookies.get(COOKIE_NAME) {
    Some(c) => c,
    None => return Ok(Redirect::to(redirect)),
  };

  let session = match session_store.load_session(cookie.to_string()).await? {
    Some(s) => s,
    None => return Ok(Redirect::to(redirect)),
  };

  debug!("Destroying session...");

  session_store.destroy_session(session).await?;

  Ok(Redirect::to(redirect))
}

fn validate_redirect(redirect: &str) -> Result<&str> {
  let base = Url::parse("https://mcgill.courses").unwrap();
  let url = base
    .join(redirect)
    .map_err(|_| Error::bad_request("Invalid redirect path"))?;

  if !redirect.starts_with('/') || url.origin() != base.origin() {
    Err(Error::bad_request("Invalid redirect path"))
  } else {
    Ok(redirect)
  }
}

fn secure_cookie_attribute(client: &OAuthClient) -> &'static str {
  if client
    .redirect_uri()
    .is_some_and(|redirect| redirect.url().scheme() == "https")
  {
    "; Secure"
  } else {
    ""
  }
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn redirect_validation() {
    assert_eq!(
      validate_redirect("/foo?bar=baz#qux").unwrap(),
      "/foo?bar=baz#qux",
    );

    for redirect in ["foo", "//example.com", "//["] {
      assert!(matches!(
        validate_redirect(redirect),
        Err(Error::BadRequest(_))
      ));
    }
  }
}
