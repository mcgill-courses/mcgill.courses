use {
  crate::{
    assets::Assets,
    auth::{AuthRedirect, COOKIE_NAME, MCGILL_TENANT_ID, OAuthClient},
    documentation::Documentation,
    error::Error,
    hash::Hash,
    object::Object,
    server::Server,
    session_store::MongodbSessionStore,
    state::State,
    user::User,
  },
  anyhow::anyhow,
  async_session::{Session, SessionStore, async_trait},
  aws_config::{BehaviorVersion, Region},
  aws_sdk_s3::{Client as S3Client, primitives::ByteStream},
  axum::{
    BoxError, Json, RequestPartsExt,
    body::Body,
    error_handling::HandleErrorLayer,
    extract::{
      FromRef, FromRequestParts, OptionalFromRequestParts, Path, Query,
      State as AppState,
    },
    response::{IntoResponse, Redirect, Response},
    routing::{Router, get},
  },
  axum_extra::{
    TypedHeader, headers::Cookie, typed_header::TypedHeaderRejectionReason,
  },
  base64::{Engine, engine::general_purpose::STANDARD},
  chrono::prelude::*,
  clap::Parser,
  db::Db,
  dotenv::dotenv,
  http::{
    HeaderMap, Request, StatusCode, header, header::SET_COOKIE, request::Parts,
  },
  indoc::indoc,
  model::{
    Course, CourseAverage, CourseFilter, CourseSortType, InitializeOptions,
    Instructor, Interaction, InteractionKind, Notification, Review,
    ReviewFilter, SearchResults, Subscription,
  },
  oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, EndpointNotSet, EndpointSet,
    RedirectUrl, Scope, TokenUrl, basic::BasicClient,
  },
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
  tower::{ServiceBuilder, timeout::TimeoutLayer},
  tower_governor::{
    GovernorError, GovernorLayer, governor::GovernorConfigBuilder,
    key_extractor::SmartIpKeyExtractor,
  },
  tower_http::{
    catch_panic::CatchPanicLayer,
    compression::CompressionLayer,
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
  },
  tracing::Span,
  tracing::{debug, error, info, info_span, trace},
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
  uuid::Uuid,
  walkdir::WalkDir,
};

mod assets;
mod auth;
mod course_averages;
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
mod session_store;
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

    if let Error::Internal(error) = error {
      for (i, cause) in error.chain().skip(1).enumerate() {
        if i == 0 {
          eprintln!();
          eprintln!("because:");
        }

        eprintln!("- {cause}");
      }

      let backtrace = error.backtrace();

      if backtrace.status() == BacktraceStatus::Captured {
        eprintln!("backtrace:");
        eprintln!("{backtrace}");
      }
    }

    process::exit(1);
  }
}
