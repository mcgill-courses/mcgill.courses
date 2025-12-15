use {
  crate::{
    assets::Assets,
    auth::{AuthRedirect, COOKIE_NAME},
    documentation::Documentation,
    error::Error,
    hash::Hash,
    object::Object,
    server::Server,
    state::State,
    user::User,
  },
  anyhow::anyhow,
  async_mongodb_session::MongodbSessionStore,
  async_session::{Session, SessionStore, async_trait},
  axum::{
    Json, RequestPartsExt,
    body::Body,
    extract::{
      FromRef, FromRequestParts, OptionalFromRequestParts, Path, Query,
      State as AppState,
    },
    response::{IntoResponse, Redirect, Response},
    routing::{Router, get, post},
  },
  axum_extra::{
    TypedHeader, headers::Cookie, typed_header::TypedHeaderRejectionReason,
  },
  base64::{Engine, engine::general_purpose::STANDARD},
  chrono::prelude::*,
  clap::Parser,
  db::Db,
  dotenv::dotenv,
  futures::TryStreamExt,
  http::{
    HeaderMap, Request, StatusCode, header, header::SET_COOKIE, request::Parts,
  },
  model::{
    Course, CourseFilter, InitializeOptions, Instructor, Interaction,
    InteractionKind, Notification, Review, ReviewFilter, SearchResults,
    Subscription,
  },
  oauth2::{
    AuthType, AuthUrl, ClientId, ClientSecret, CsrfToken, RedirectUrl, Scope,
    TokenUrl, basic::BasicClient,
  },
  rusoto_core::Region,
  rusoto_s3::S3Client,
  rusoto_s3::{GetObjectRequest, PutObjectOutput, PutObjectRequest, S3},
  serde::{Deserialize, Serialize},
  sha2::{Digest, Sha256},
  std::{
    backtrace::BacktraceStatus,
    convert::Infallible,
    env,
    fmt::{self, Display, Formatter},
    fs,
    fs::File,
    io::Read,
    net::SocketAddr,
    path::PathBuf,
    process,
    sync::Arc,
    thread,
    time::Duration,
  },
  tokio::net::TcpListener,
  tower::ServiceBuilder,
  tower_governor::{GovernorLayer, governor::GovernorConfigBuilder},
  tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
  },
  tracing::Span,
  tracing::{debug, error, info, trace},
  tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt},
  typeshare::typeshare,
  url::Url,
  utoipa::{
    Modify, OpenApi, ToSchema,
    openapi::{
      Components,
      security::{AuthorizationCode, Flow, OAuth2, Scopes, SecurityScheme},
    },
  },
  utoipa_scalar::{Scalar, Servable},
  walkdir::WalkDir,
};

mod assets;
mod auth;
mod courses;
mod documentation;
mod error;
mod hash;
mod instructors;
mod interactions;
mod notifications;
mod object;
mod options;
mod reviews;
mod search;
mod server;
mod state;
mod subscriptions;
mod user;

type Result<T = (), E = error::Error> = std::result::Result<T, E>;

#[tokio::main]
async fn main() {
  let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
    .unwrap_or_else(|_| "info,tower_http=debug,hyper=debug".into());

  let fmt_layer = tracing_subscriber::fmt::layer()
    .with_target(true)
    .with_thread_ids(true)
    .with_file(true)
    .with_line_number(true);

  if env::var("ENV").unwrap_or_default() == "production" {
    tracing_subscriber::registry()
      .with(env_filter)
      .with(fmt_layer.json())
      .init();
  } else {
    tracing_subscriber::registry()
      .with(env_filter)
      .with(fmt_layer.pretty())
      .init();
  }

  dotenv().ok();

  if let Err(error) = Server::parse().run().await {
    eprintln!("error: {error}");

    for (i, error) in error.0.chain().skip(1).enumerate() {
      if i == 0 {
        eprintln!();
        eprintln!("because:");
      }

      eprintln!("- {error}");
    }

    let backtrace = error.0.backtrace();

    if backtrace.status() == BacktraceStatus::Captured {
      eprintln!("backtrace:");
      eprintln!("{backtrace}");
    }

    process::exit(1);
  }
}
