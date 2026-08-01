use super::*;

#[derive(Debug, Clone)]
pub(crate) struct State {
  pub(crate) client_secret: String,
  pub(crate) db: Arc<Db>,
  pub(crate) oauth_client: OAuthClient,
  pub(crate) oauth_flow_store: OAuthFlowStore,
  pub(crate) request_client: reqwest::Client,
  pub(crate) session_store: MongodbSessionStore,
}

impl FromRef<State> for Arc<Db> {
  fn from_ref(state: &State) -> Self {
    state.db.clone()
  }
}

impl FromRef<State> for OAuthClient {
  fn from_ref(state: &State) -> Self {
    state.oauth_client.clone()
  }
}

impl FromRef<State> for reqwest::Client {
  fn from_ref(state: &State) -> Self {
    state.request_client.clone()
  }
}

impl FromRef<State> for MongodbSessionStore {
  fn from_ref(state: &State) -> Self {
    state.session_store.clone()
  }
}

impl State {
  pub(crate) async fn new(
    db: Arc<Db>,
    session_store: MongodbSessionStore,
  ) -> Result<Self> {
    let client_secret = env::var("MS_CLIENT_SECRET")
      .expect("Missing the MS_CLIENT_SECRET environment variable.");
    let oauth_flow_store = OAuthFlowStore::new(
      &env::var("MONGODB_URL").unwrap_or_else(|_| {
        "mongodb://localhost:27017/?directConnection=true&replicaSet=rs0".into()
      }),
      &db.name(),
    )
    .await?;

    Ok(Self {
      client_secret: client_secret.clone(),
      db: db.clone(),
      oauth_client: BasicClient::new(ClientId::new(
        env::var("MS_CLIENT_ID")
          .expect("Missing the MS_CLIENT_ID environment variable"),
      ))
      .set_client_secret(ClientSecret::new(client_secret))
      .set_auth_uri(
        AuthUrl::new(format!(
          "https://login.microsoftonline.com/{MCGILL_TENANT_ID}/oauth2/v2.0/authorize",
        ))
        .expect("Invalid authorization URL"),
      )
      .set_token_uri(
        TokenUrl::new(format!(
          "https://login.microsoftonline.com/{MCGILL_TENANT_ID}/oauth2/v2.0/token",
        ))
        .expect("Invalid token endpoint URL"),
      )
      .set_redirect_uri(
        RedirectUrl::new(
          env::var("MS_REDIRECT_URI")
            .expect("Missing the MS_REDIRECT_URI environment variable."),
        )
        .expect("Invalid redirect URL"),
      ),
      oauth_flow_store,
      request_client: reqwest::Client::new(),
      session_store,
    })
  }
}
