use super::*;

#[derive(Parser)]
pub(crate) struct Server {
  #[clap(long, default_value = "courses.json")]
  source: PathBuf,
  #[clap(long, help = "Directory to serve assets from")]
  asset_dir: Option<PathBuf>,
  #[clap(long, default_value = "8000", help = "Port to listen on")]
  port: u16,
  #[clap(long, default_value = "admin", help = "Database name")]
  db_name: String,
  #[clap(long, default_value = "false", help = "Seed latest courses only")]
  latest_courses: bool,
  #[clap(long, default_value = "false", help = "Enable multithreaded seeding")]
  multithreaded: bool,
  #[clap(long, default_value = "false", help = "Initialize the database")]
  initialize: bool,
  #[clap(long, default_value = "false", help = "Skip course seeding")]
  skip_courses: bool,
  #[clap(long, default_value = "false", help = "Skip review seeding")]
  skip_reviews: bool,
}

#[derive(Debug)]
struct AppConfig<'a> {
  db: Arc<Db>,
  assets: Option<Assets<'a>>,
  session_store: MongodbSessionStore,
  rate_limit: bool,
}

impl Server {
  pub(crate) async fn run(self) -> Result {
    let addr = SocketAddr::from(([0, 0, 0, 0], self.port));

    info!("Listening on port: {}", addr.port());

    let db = Arc::new(Db::connect(&self.db_name).await?);

    if self.initialize {
      let source_hash = self.source.hash()?;

      let client = match env::var("ENV") {
        Ok(env) if env == "production" => Some(S3Client::new(Region::UsEast1)),
        _ => None,
      };

      let prev_hash = match client {
        Some(ref client) => client.get("mcgill.courses", "source-hash").await?,
        None => None,
      };

      if Some(&source_hash) != prev_hash.as_ref() {
        let clone = db.clone();

        if let Some(client) = client {
          client
            .put("mcgill.courses", "source-hash", source_hash)
            .await?;
        }

        tokio::spawn(async move {
          if let Err(error) = clone
            .initialize(InitializeOptions {
              latest_courses: self.latest_courses,
              multithreaded: self.multithreaded,
              skip_courses: self.skip_courses,
              skip_reviews: self.skip_reviews,
              source: self.source,
            })
            .await
          {
            error!("error: {error}");
          }
        });
      }
    }

    let assets = self.asset_dir.as_ref().map(|asset_dir| Assets {
      dir: ServeDir::new(asset_dir.clone()),
      index: ServeFile::new(asset_dir.join("index.html")),
      route: "/assets",
    });

    let session_store = MongodbSessionStore::new(
      &env::var("MONGODB_URL").unwrap_or_else(|_| {
        "mongodb://localhost:27017/?directConnection=true&replicaSet=rs0".into()
      }),
      &db.name(),
      "store",
    )
    .await?;

    let app = Self::app(AppConfig {
      db,
      assets,
      session_store,
      rate_limit: true,
    })
    .await?;

    axum::serve(
      TcpListener::bind(addr).await?,
      app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
  }

  async fn app(config: AppConfig<'_>) -> Result<Router> {
    let mut router = Router::new()
      .route("/api/auth/authorized", get(auth::login_authorized))
      .route("/api/auth/login", get(auth::microsoft_auth))
      .route("/api/auth/logout", get(auth::logout))
      .route("/api/courses", get(courses::get_courses))
      .route("/api/courses/{id}", get(courses::get_course_by_id))
      .route("/api/instructors/{name}", get(instructors::get_instructor))
      .route(
        "/api/interactions/{course_id}/referrer/{referrer}",
        get(interactions::get_user_interactions_for_course),
      )
      .route(
        "/api/interactions",
        get(interactions::get_interaction_kind)
          .post(interactions::add_interaction)
          .delete(interactions::delete_interaction),
      )
      .route(
        "/api/notifications",
        get(notifications::get_notifications)
          .put(notifications::update_notification)
          .delete(notifications::delete_notification),
      )
      .route(
        "/api/reviews",
        get(reviews::get_reviews)
          .delete(reviews::delete_review)
          .post(reviews::add_review)
          .put(reviews::update_review),
      )
      .route("/api/reviews/liked", get(reviews::get_liked_reviews))
      .route("/api/reviews/{id}", get(reviews::get_review))
      .route("/api/search", get(search::search))
      .route(
        "/api/subscriptions",
        get(subscriptions::get_subscription)
          .post(subscriptions::add_subscription)
          .delete(subscriptions::delete_subscription),
      )
      .route("/api/user", get(user::get_user))
      .merge(
        Scalar::with_url("/api/docs", Documentation::openapi()).custom_html(indoc! {
          r#"
          <!doctype html>
          <html>
          <head>
            <title>API - mcgill.courses</title>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
          </head>
          <body>
          <script id="api-reference" type="application/json">
            $spec
          </script>
          <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
          </body>
          </html>
          "#
        }),
      );

    // Serve microsoft identity association file
    router = router.route(
      "/.well-known/microsoft-identity-association.json",
      get(|| async {
        info!("Serving microsoft-identity-association.json");

        fs::read_to_string(PathBuf::from(
          ".well-known/microsoft-identity-association.json",
        ))
        .unwrap_or_else(|_| "Error reading file".to_string())
      }),
    );

    if let Some(assets) = config.assets {
      info!("Adding asset directory to router...");

      router = router
        .nest_service(assets.route, assets.dir)
        .fallback_service(assets.index)
    }

    let governor_config = GovernorConfigBuilder::default()
      .per_millisecond(10)
      .burst_size(100)
      .finish()
      .ok_or(anyhow!("Failed to create governor configuration"))?;

    let governor_limiter = governor_config.limiter().clone();

    let interval = Duration::from_secs(60);

    thread::spawn(move || {
      loop {
        thread::sleep(interval);
        governor_limiter.retain_recent();
      }
    });

    let trace_layer = TraceLayer::new_for_http()
      .make_span_with(|request: &Request<Body>| {
        let request_id = uuid::Uuid::new_v4().to_string();

        info_span!(
          "http_request",
          method = %request.method(),
          uri = %request.uri(),
          path = %request.uri().path(),
          query = %request.uri().query().unwrap_or(""),
          request_id = %request_id,
          user_agent = %request.headers()
            .get("user-agent")
            .and_then(|header| header.to_str().ok())
            .unwrap_or("unknown"),
        )
      })
      .on_request(|_request: &Request<Body>, span: &Span| {
        info!(parent: span, "request started");
      })
      .on_response(|response: &Response, latency: Duration, span: &Span| {
        info!(
          parent: span,
          status = %response.status(),
          latency_ms = %latency.as_millis(),
          "request completed"
        );
      })
      .on_failure(
        |error: tower_http::classify::ServerErrorsFailureClass,
         latency: Duration,
         span: &Span| {
          error!(
            parent: span,
            error = %error,
            latency_ms = %latency.as_millis(),
            "request failed"
          );
        },
      );

    Ok(
      router
        .with_state(State::new(config.db, config.session_store).await?)
        .layer(
          ServiceBuilder::new()
            .layer(CatchPanicLayer::new())
            .layer(HandleErrorLayer::new(|error: BoxError| async move {
              if error.is::<tower::timeout::error::Elapsed>() {
                StatusCode::REQUEST_TIMEOUT
              } else {
                StatusCode::INTERNAL_SERVER_ERROR
              }
            }))
            .layer(TimeoutLayer::new(Duration::from_secs(30)))
            .layer(CompressionLayer::new())
            .layer(trace_layer)
            .layer(tower::util::option_layer(
              config
                .rate_limit
                .then(|| GovernorLayer::new(governor_config)),
            ))
            .layer(CorsLayer::very_permissive()),
        ),
    )
  }
}

#[cfg(test)]
mod tests {
  use {
    super::*,
    crate::{
      instructors::GetInstructorPayload,
      interactions::GetUserInteractionForCoursePayload,
      subscriptions::SubscriptionResponse,
    },
    axum::body::Body,
    courses::{GetCourseByIdPayload, GetCoursesPayload},
    http::{Method, Request},
    interactions::GetInteractionKindPayload,
    model::{Notification, Subscription},
    pretty_assertions::assert_eq,
    reviews::GetReviewsPayload,
    serde::de::DeserializeOwned,
    serde_json::json,
    std::{
      collections::HashSet,
      sync::atomic::{AtomicUsize, Ordering},
    },
    tower::{Service, ServiceExt},
  };

  macro_rules! assert_matches {
    ($expression:expr, $( $pattern:pat_param )|+ $( if $guard:expr )? $(,)?) => {
      match $expression {
        $( $pattern )|+ $( if $guard )? => {}
        left => panic!(
          "assertion failed: (left ~= right)\n  left: `{:?}`\n right: `{}`",
          left,
          stringify!($($pattern)|+ $(if $guard)?)
        ),
      }
    };
  }

  struct TestContext {
    app: Router,
    db: Arc<Db>,
    session_store: MongodbSessionStore,
  }

  impl TestContext {
    async fn new() -> Self {
      dotenv().ok();

      static TEST_DATABASE_NUMBER: AtomicUsize = AtomicUsize::new(0);

      let test_database_number =
        TEST_DATABASE_NUMBER.fetch_add(1, Ordering::Relaxed);

      let db_name = format!(
        "mcgill-courses-test-{}-{}",
        std::time::SystemTime::now()
          .duration_since(std::time::SystemTime::UNIX_EPOCH)
          .unwrap()
          .as_millis(),
        test_database_number,
      );

      let db = Arc::new(Db::connect(&db_name).await.unwrap());

      let session_store = MongodbSessionStore::new(
        "mongodb://localhost:27017/?directConnection=true&replicaSet=rs0",
        &db.name(),
        "store",
      )
      .await
      .unwrap();

      let app = Server::app(AppConfig {
        db: db.clone(),
        assets: None,
        session_store: session_store.clone(),
        rate_limit: false,
      })
      .await
      .unwrap();

      TestContext {
        app,
        db,
        session_store,
      }
    }
  }

  fn seed() -> PathBuf {
    PathBuf::from("crates/db/test-seeds/mini.json")
  }

  async fn mock_login(
    session_store: MongodbSessionStore,
    id: &str,
    mail: &str,
  ) -> String {
    let mut session = Session::new();

    session.insert("user", User::new(id, mail)).unwrap();

    format!(
      "{}={}",
      COOKIE_NAME,
      session_store.store_session(session).await.unwrap().unwrap()
    )
  }

  #[async_trait]
  trait ResponseExt {
    async fn convert<T: DeserializeOwned>(self) -> T;
  }

  #[async_trait]
  impl ResponseExt for Response {
    async fn convert<T: DeserializeOwned>(self) -> T {
      serde_json::from_slice::<T>(
        &axum::body::to_bytes(self.into_body(), usize::MAX)
          .await
          .unwrap(),
      )
      .unwrap()
    }
  }

  #[tokio::test]
  async fn courses_route_works() {
    let TestContext { db, app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let response = app
      .oneshot(
        Request::builder()
          .method(Method::GET)
          .uri("/api/courses")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response.convert::<GetCoursesPayload>().await;

    assert_eq!(payload.courses, db.courses(None, None, None).await.unwrap());
    assert_eq!(payload.course_count, None);
  }

  #[tokio::test]
  async fn courses_route_offset_limit() {
    let TestContext { db, app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let response = app
      .oneshot(
        Request::builder()
          .method(Method::GET)
          .uri("/api/courses?limit=10&offset=40")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response.convert::<GetCoursesPayload>().await;

    assert_eq!(
      payload.courses,
      db.courses(Some(10), Some(40), None).await.unwrap()
    );
  }

  #[tokio::test]
  async fn courses_route_disallows_negative_limit_or_offset() {
    let TestContext { app, .. } = TestContext::new().await;

    let response = app
      .clone()
      .oneshot(
        Request::builder()
          .method(Method::GET)
          .uri("/api/courses?limit=-10&offset=-10")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
  }

  #[tokio::test]
  async fn courses_route_with_filters() {
    let TestContext { db, app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "COMP202".into(),
      user_id: "1".into(),
      rating: 3,
      difficulty: 2,
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "COMP252".into(),
      user_id: "1".into(),
      rating: 5,
      difficulty: 4,
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "MATH240".into(),
      user_id: "1".into(),
      rating: 4,
      difficulty: 3,
      ..Default::default()
    })
    .await
    .unwrap();

    async fn case(app: Router, uri: &str, expected_ids: &[&str]) {
      let response = app
        .oneshot(
          Request::builder()
            .method(Method::GET)
            .uri(uri)
            .body(Body::empty())
            .unwrap(),
        )
        .await
        .unwrap();

      assert_eq!(response.status(), StatusCode::OK);

      let payload = response.convert::<GetCoursesPayload>().await;

      let ids = payload
        .courses
        .iter()
        .map(|course| course.id.as_str())
        .collect::<Vec<&str>>();

      assert_eq!(ids, expected_ids);
    }

    case(
      app.clone(),
      "/api/courses?subjects=COMP&sortType=rating&sortReverse=true",
      &["COMP252", "COMP202"],
    )
    .await;

    case(
      app.clone(),
      "/api/courses?subjects=COMP&sortType=rating&sortReverse=false",
      &["COMP202", "COMP252"],
    )
    .await;

    case(
      app.clone(),
      "/api/courses?sortType=difficulty&sortReverse=true",
      &["COMP252", "MATH240", "COMP202"],
    )
    .await;

    case(
      app.clone(),
      "/api/courses?levels=2&sortType=reviewCount&sortReverse=true",
      &["COMP202", "COMP252", "MATH240"],
    )
    .await;

    case(app.clone(), "/api/courses?query=Honours", &["COMP252"]).await;

    case(
      app.clone(),
      "/api/courses?subjects=COMP,MATH&levels=2",
      &["COMP202", "COMP252", "MATH240"],
    )
    .await;

    case(app.clone(), "/api/courses?subjects=PHYS", &[]).await;

    case(app.clone(), "/api/courses?levels=1", &[]).await;
  }

  #[tokio::test]
  async fn course_by_id_works() {
    let TestContext { db, app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let response = app
      .oneshot(
        Request::builder()
          .uri("/api/courses/COMP202")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      response.convert::<GetCourseByIdPayload>().await.course,
      db.find_course_by_id("COMP202").await.unwrap().unwrap()
    );
  }

  #[tokio::test]
  async fn course_by_id_is_case_insensitive() {
    let TestContext { db, app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    for id in ["comp202", "Comp202", "COMP202", "cOmP202"] {
      let response = app
        .clone()
        .oneshot(
          Request::builder()
            .uri(format!("/api/courses/{id}"))
            .body(Body::empty())
            .unwrap(),
        )
        .await
        .unwrap();

      assert_eq!(response.status(), StatusCode::OK, "failed for id: {id}");
    }
  }

  #[tokio::test]
  async fn can_get_course_with_reviews() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(session_store, "test", "test@mail.mcgill.ca").await;

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("test").await.unwrap().len(), 1);

    let response = app
      .call(
        Request::builder()
          .uri("/api/courses/MATH240?with_reviews=true")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response.convert::<GetCourseByIdPayload>().await;

    assert_eq!(
      payload.course,
      db.find_course_by_id("MATH240").await.unwrap().unwrap()
    );

    assert_eq!(payload.reviews.len(), 1);
  }

  #[tokio::test]
  async fn course_by_id_invalid_course_code() {
    let TestContext { db, app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let response = app
      .oneshot(
        Request::builder()
          .uri("/api/courses/COMP1337")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    assert_eq!(response.convert::<Option<Course>>().await, None);
  }

  #[tokio::test]
  async fn unauthenticated_cant_add_review() {
    let TestContext { db, app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let response = app
      .oneshot(
        Request::builder()
          .method(http::Method::POST)
          .uri("/api/reviews")
          .body(Body::from(
            json!({"content": "test", "course_id": "MATH240"}).to_string(),
          ))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
  }

  #[tokio::test]
  async fn can_add_review() {
    let TestContext {
      db,
      app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .oneshot(
        Request::builder()
          .method(http::Method::POST)
          .header(
            "Cookie",
            mock_login(session_store, "test", "test@mail.mcgill.ca").await,
          )
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(db.find_reviews_by_user_id("test").await.unwrap().len(), 1);
  }

  #[tokio::test]
  async fn throws_error_when_invalid_instructor() {
    let TestContext {
      db,
      app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta", "lmao"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .oneshot(
        Request::builder()
          .method(http::Method::POST)
          .header(
            "Cookie",
            mock_login(session_store, "test", "test@mail.mcgill.ca").await,
          )
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
  }

  #[tokio::test]
  async fn can_delete_review() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(session_store, "test", "test@mail.mcgill.ca").await;

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("test").await.unwrap().len(), 1);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::DELETE)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(json!({"course_id": "MATH240"}).to_string()))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("test").await.unwrap().len(), 0);
  }

  #[tokio::test]
  async fn can_update_review() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(session_store, "test", "test@mail.mcgill.ca").await;

    let review = json!({
        "content": "test",
        "course_id": "MATH240",
        "instructors": ["Adrian Roshan Vetta"],
        "rating": 1,
        "difficulty": 5
    })
    .to_string();

    app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    let review = json!({
      "content": "updated",
      "course_id": "MATH240",
      "instructors": ["Jeremy Macdonald"],
      "rating": 5,
      "difficulty": 2
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::PUT)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let review = db.find_review("MATH240", "test").await.unwrap().unwrap();

    assert_eq!(review.content, "updated");
    assert_eq!(review.instructors, vec![String::from("Jeremy Macdonald")]);
    assert_eq!(review.rating, 5);
  }

  #[tokio::test]
  async fn can_get_reviews_by_user_id() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie =
      mock_login(session_store.clone(), "test", "test@mail.mcgill.ca").await;

    let reviews = vec![
      json!({
        "content": "test",
        "course_id": "COMP202",
        "instructors": ["Jonathan Campbell"],
        "rating": 5,
        "difficulty": 5
      }),
      json!({
        "content": "test2",
        "course_id": "MATH240",
        "instructors": ["Adrian Roshan Vetta"],
        "rating": 5,
        "difficulty": 5
      }),
      json!({
        "content": "test3",
        "course_id": "COMP252",
        "instructors": ["Luc P Devroye"],
        "rating": 5,
        "difficulty": 5
      }),
    ];

    for review in reviews {
      app
        .call(
          Request::builder()
            .method(http::Method::POST)
            .header("Cookie", cookie.clone())
            .header("Content-Type", "application/json")
            .uri("/api/reviews")
            .body(Body::from(review.to_string()))
            .unwrap(),
        )
        .await
        .unwrap();
    }

    app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header(
            "Cookie",
            mock_login(session_store, "test2", "test2@mail.mcgill.ca").await,
          )
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(
            json!({"content": "test4", "course_id": "COMP202"}).to_string(),
          ))
          .unwrap(),
      )
      .await
      .unwrap();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .uri("/api/reviews?user_id=test")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      response.convert::<GetReviewsPayload>().await.reviews.len(),
      3
    );
  }

  #[tokio::test]
  async fn can_get_reviews_by_course_id() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookies = [
      mock_login(session_store.clone(), "test", "test@mail.mcgill.ca").await,
      mock_login(session_store, "test2", "test2@mail.mcgill.ca").await,
    ];

    let reviews = vec![
      json!({
        "content": "test",
        "course_id": "MATH240",
        "instructors": ["Adrian Roshan Vetta"],
        "rating": 5,
        "difficulty": 5
      }),
      json!({
         "content": "test2",
         "course_id": "MATH240",
         "instructors": ["Adrian Roshan Vetta"],
         "rating": 5,
         "difficulty": 5
      }),
    ];

    for (cookie, review) in cookies.iter().zip(reviews) {
      app
        .call(
          Request::builder()
            .method(http::Method::POST)
            .header("Cookie", cookie.clone())
            .header("Content-Type", "application/json")
            .uri("/api/reviews")
            .body(Body::from(review.to_string()))
            .unwrap(),
        )
        .await
        .unwrap();
    }

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .uri("/api/reviews?course_id=MATH240")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      response.convert::<GetReviewsPayload>().await.reviews.len(),
      2
    )
  }

  #[tokio::test]
  async fn can_interact_with_reviews() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(session_store, "test", "test@mail.mcgill.ca").await;

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions?course_id=MATH240&user_id=test&referrer=test")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(
      response.convert::<GetInteractionKindPayload>().await,
      GetInteractionKindPayload { kind: None }
    );

    let interaction = json! ({
      "kind": "like",
      "course_id": "MATH240",
      "user_id": "test",
      "referrer": "test"
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions")
          .body(Body::from(interaction))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      db.interactions_for_review("MATH240", "test")
        .await
        .unwrap()
        .len(),
      1
    );

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions?course_id=MATH240&user_id=test&referrer=test")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      response.convert::<GetInteractionKindPayload>().await,
      GetInteractionKindPayload {
        kind: Some(InteractionKind::Like),
      }
    );

    let interaction = json! ({
      "course_id": "MATH240",
      "user_id": "test",
      "referrer": "test"
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::DELETE)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions")
          .body(Body::from(interaction))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      db.interactions_for_review("MATH240", "test")
        .await
        .unwrap()
        .len(),
      0
    );

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions?course_id=MATH240&user_id=test&referrer=test")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      response.convert::<GetInteractionKindPayload>().await,
      GetInteractionKindPayload { kind: None }
    );
  }

  #[tokio::test]
  async fn can_get_liked_reviews() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let author_cookie =
      mock_login(session_store.clone(), "author1", "author1@mail.mcgill.ca")
        .await;
    let author_two_cookie =
      mock_login(session_store.clone(), "author2", "author2@mail.mcgill.ca")
        .await;

    let reviews = vec![
      (
        author_cookie,
        json!({
          "content": "test",
          "course_id": "COMP202",
          "instructors": ["Jonathan Campbell"],
          "rating": 5,
          "difficulty": 4
        }),
      ),
      (
        author_two_cookie,
        json!({
          "content": "test2",
          "course_id": "MATH240",
          "instructors": ["Adrian Roshan Vetta"],
          "rating": 4,
          "difficulty": 3
        }),
      ),
    ];

    for (cookie, review) in reviews {
      app
        .call(
          Request::builder()
            .method(http::Method::POST)
            .header("Cookie", cookie)
            .header("Content-Type", "application/json")
            .uri("/api/reviews")
            .body(Body::from(review.to_string()))
            .unwrap(),
        )
        .await
        .unwrap();
    }

    let liker_cookie =
      mock_login(session_store.clone(), "liker", "liker@mail.mcgill.ca").await;

    let like = json!({
      "kind": "like",
      "course_id": "COMP202",
      "user_id": "author1",
      "referrer": "liker"
    })
    .to_string();

    app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", liker_cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions")
          .body(Body::from(like))
          .unwrap(),
      )
      .await
      .unwrap();

    let dislike = json!({
      "kind": "dislike",
      "course_id": "MATH240",
      "user_id": "author2",
      "referrer": "liker"
    })
    .to_string();

    app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", liker_cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions")
          .body(Body::from(dislike))
          .unwrap(),
      )
      .await
      .unwrap();

    let other_cookie =
      mock_login(session_store, "other", "other@mail.mcgill.ca").await;
    let other_like = json!({
      "kind": "like",
      "course_id": "MATH240",
      "user_id": "author2",
      "referrer": "other"
    })
    .to_string();

    app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", other_cookie)
          .header("Content-Type", "application/json")
          .uri("/api/interactions")
          .body(Body::from(other_like))
          .unwrap(),
      )
      .await
      .unwrap();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", liker_cookie)
          .uri("/api/reviews/liked")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response.convert::<GetReviewsPayload>().await;

    assert_eq!(payload.reviews.len(), 1);
    assert_eq!(payload.reviews[0].course_id, "COMP202");
    assert_eq!(payload.reviews[0].user_id, "author1");
  }

  #[tokio::test]
  async fn returns_empty_liked_reviews() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let author_cookie =
      mock_login(session_store.clone(), "author1", "author1@mail.mcgill.ca")
        .await;
    let review = json!({
      "content": "test",
      "course_id": "COMP202",
      "instructors": ["Jonathan Campbell"],
      "rating": 5,
      "difficulty": 4
    })
    .to_string();

    app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", author_cookie)
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    let liker_cookie =
      mock_login(session_store, "liker", "liker@mail.mcgill.ca").await;

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", liker_cookie)
          .uri("/api/reviews/liked")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response.convert::<GetReviewsPayload>().await;

    assert_eq!(payload.reviews.len(), 0);
  }

  #[tokio::test]
  async fn get_invalid_instructor() {
    let TestContext { db, mut app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Content-Type", "application/json")
          .uri("/api/instructors/foobar")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    let payload = response.convert::<GetInstructorPayload>().await;

    assert_eq!(payload.instructor, None);
    assert_eq!(payload.reviews.len(), 0);
  }

  #[tokio::test]
  async fn can_get_instructors_with_reviews() {
    let TestContext {
      db,
      mut app,
      session_store,
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(session_store, "test", "test@mail.mcgill.ca").await;

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("test").await.unwrap().len(), 1);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Content-Type", "application/json")
          .uri("/api/instructors/Adrian%20Roshan%20Vetta")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response.convert::<GetInstructorPayload>().await;

    assert_eq!(
      payload.instructor,
      Some(Instructor {
        name: "Adrian Roshan Vetta".to_string(),
        name_ngrams: Some(
          "Adr Adri Adria Adrian Ros Rosh Rosha Roshan Vet Vett Vetta".into()
        ),
        term: "Fall 2022".into(),
      })
    );

    assert_eq!(payload.reviews.len(), 1)
  }

  #[tokio::test]
  async fn get_empty_user_interactions_for_course() {
    let TestContext { db, mut app, .. } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Content-Type", "application/json")
          .uri("/api/interactions/COMP202/referrer/test")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response
      .convert::<GetUserInteractionForCoursePayload>()
      .await;

    assert_eq!(payload.course_id, "COMP202");
    assert_eq!(payload.interactions.len(), 0);
  }

  #[tokio::test]
  async fn get_user_interactions_for_course() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(session_store, "test", "test@mail.mcgill.ca").await;

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("test").await.unwrap().len(), 1);

    let interaction = json! ({
      "kind": "like",
      "course_id": "MATH240",
      "user_id": "test",
      "referrer": "test"
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions")
          .body(Body::from(interaction))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      db.interactions_for_review("MATH240", "test")
        .await
        .unwrap()
        .len(),
      1
    );

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Content-Type", "application/json")
          .uri("/api/interactions/MATH240/referrer/test")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response
      .convert::<GetUserInteractionForCoursePayload>()
      .await;

    assert_eq!(payload.course_id, "MATH240");
    assert_eq!(payload.interactions.len(), 1);
    assert_eq!(payload.interactions[0].kind, InteractionKind::Like);
    assert_eq!(payload.interactions[0].referrer, "test");
  }

  #[tokio::test]
  async fn interactions_deleted_for_deleted_reviews() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(session_store, "test", "test@mail.mcgill.ca").await;

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("test").await.unwrap().len(), 1);

    let interaction = json! ({
      "kind": "like",
      "course_id": "MATH240",
      "user_id": "test",
      "referrer": "test"
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions")
          .body(Body::from(interaction))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_eq!(
      db.interactions_for_review("MATH240", "test")
        .await
        .unwrap()
        .len(),
      1
    );

    let response = app
      .call(
        Request::builder()
          .method(http::Method::DELETE)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(json!({"course_id": "MATH240"}).to_string()))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("test").await.unwrap().len(), 0);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/interactions?course_id=MATH240&user_id=test&referrer=test")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(
      response.convert::<GetInteractionKindPayload>().await,
      GetInteractionKindPayload { kind: None }
    );
  }

  #[tokio::test]
  async fn get_subscriptions_returns_multiple_for_user() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(
      session_store.clone(),
      "subscriber",
      "subscriber@mail.mcgill.ca",
    )
    .await;

    for course_id in ["MATH240", "COMP202"] {
      let response = app
        .call(
          Request::builder()
            .method(http::Method::POST)
            .header("Cookie", cookie.clone())
            .header("Content-Type", "application/json")
            .uri("/api/subscriptions")
            .body(Body::from(
              json!({
                "course_id": course_id,
              })
              .to_string(),
            ))
            .unwrap(),
        )
        .await
        .unwrap();

      assert_eq!(response.status(), StatusCode::OK);
    }

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response.convert::<SubscriptionResponse>().await;

    match payload {
      SubscriptionResponse::Multiple(subscriptions) => {
        assert_eq!(subscriptions.len(), 2);

        let course_ids = subscriptions
          .iter()
          .map(|subscription| subscription.course_id.as_str())
          .collect::<HashSet<&str>>();

        let expected = ["MATH240", "COMP202"]
          .into_iter()
          .collect::<HashSet<&str>>();

        assert_eq!(course_ids, expected);

        assert!(
          subscriptions
            .iter()
            .all(|subscription| subscription.user_id == "subscriber")
        );
      }
      other => panic!("expected multiple subscriptions, got {:?}", other),
    }
  }

  #[tokio::test]
  async fn get_subscription_returns_single_match() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(
      session_store.clone(),
      "subscriber",
      "subscriber@mail.mcgill.ca",
    )
    .await;

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions")
          .body(Body::from(
            json!({
              "course_id": "MATH240",
            })
            .to_string(),
          ))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", cookie.clone())
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions?course_id=MATH240")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    assert_matches!(
      response.convert::<SubscriptionResponse>().await,
      SubscriptionResponse::Single(Some(Subscription {
        course_id,
        user_id,
      })) if course_id == "MATH240" && user_id == "subscriber"
    );
  }

  #[tokio::test]
  async fn get_subscription_returns_none_when_missing() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let cookie = mock_login(
      session_store.clone(),
      "subscriber",
      "subscriber@mail.mcgill.ca",
    )
    .await;

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", cookie)
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions?course_id=MATH240")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let payload = response.convert::<SubscriptionResponse>().await;

    assert_matches!(payload, SubscriptionResponse::Single(None));
  }

  #[tokio::test]
  async fn notify_subscriber() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let (a, b) = (
      mock_login(session_store.clone(), "a", "a@mail.mcgill.ca").await,
      mock_login(session_store, "b", "b@mail.mcgill.ca").await,
    );

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions")
          .body(Body::from(json!({ "course_id": "MATH240" }).to_string()))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(db.get_subscription("a", "MATH240").await.unwrap().is_some());

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", b)
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("b").await.unwrap().len(), 1);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", a)
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.convert::<Vec<Notification>>().await.len(), 1);
  }

  #[tokio::test]
  async fn delete_subscription() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let (a, b) = (
      mock_login(session_store.clone(), "a", "a@mail.mcgill.ca").await,
      mock_login(session_store, "b", "b@mail.mcgill.ca").await,
    );

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions")
          .body(Body::from(json!({ "course_id": "MATH240" }).to_string()))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(db.get_subscription("a", "MATH240").await.unwrap().is_some());

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", b)
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("b").await.unwrap().len(), 1);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.convert::<Vec<Notification>>().await.len(), 1);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::DELETE)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions")
          .body(Body::from(json!({ "course_id": "MATH240" }).to_string()))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", a)
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.convert::<Vec<Notification>>().await.len(), 0);
  }

  #[tokio::test]
  async fn delete_notifications() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let (a, b) = (
      mock_login(session_store.clone(), "a", "a@mail.mcgill.ca").await,
      mock_login(session_store, "b", "b@mail.mcgill.ca").await,
    );

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions")
          .body(Body::from(json!({ "course_id": "MATH240" }).to_string()))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(db.get_subscription("a", "MATH240").await.unwrap().is_some());

    let review = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", b)
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(db.find_reviews_by_user_id("b").await.unwrap().len(), 1);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.convert::<Vec<Notification>>().await.len(), 1);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::DELETE)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::from(
            json!({
              "course_id": "MATH240",
              "user_id": "b"
            })
            .to_string(),
          ))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", a)
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.convert::<Vec<Notification>>().await.len(), 0);
  }

  #[tokio::test]
  async fn delete_notification_scopes_to_review_user() {
    let TestContext {
      db,
      mut app,
      session_store,
      ..
    } = TestContext::new().await;

    db.initialize(InitializeOptions {
      source: seed(),
      ..Default::default()
    })
    .await
    .unwrap();

    let (a, b, c) = (
      mock_login(session_store.clone(), "a", "a@mail.mcgill.ca").await,
      mock_login(session_store.clone(), "b", "b@mail.mcgill.ca").await,
      mock_login(session_store, "c", "c@mail.mcgill.ca").await,
    );

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/subscriptions")
          .body(Body::from(json!({ "course_id": "MATH240" }).to_string()))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(db.get_subscription("a", "MATH240").await.unwrap().is_some());

    let review_b = json!({
      "content": "test",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 5,
      "difficulty": 5
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", b)
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review_b))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let review_c = json!({
      "content": "another",
      "course_id": "MATH240",
      "instructors": ["Adrian Roshan Vetta"],
      "rating": 4,
      "difficulty": 3
    })
    .to_string();

    let response = app
      .call(
        Request::builder()
          .method(http::Method::POST)
          .header("Cookie", c)
          .header("Content-Type", "application/json")
          .uri("/api/reviews")
          .body(Body::from(review_c))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.convert::<Vec<Notification>>().await.len(), 2);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::DELETE)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::from(
            json!({
              "course_id": "MATH240",
              "user_id": "missing"
            })
            .to_string(),
          ))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.convert::<Vec<Notification>>().await.len(), 2);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::DELETE)
          .header("Cookie", a.clone())
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::from(
            json!({
              "course_id": "MATH240",
              "user_id": "b"
            })
            .to_string(),
          ))
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let response = app
      .call(
        Request::builder()
          .method(http::Method::GET)
          .header("Cookie", a)
          .header("Content-Type", "application/json")
          .uri("/api/notifications")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let notifications = response.convert::<Vec<Notification>>().await;
    assert_eq!(notifications.len(), 1);
    assert_eq!(notifications[0].review.user_id, "c");
  }
}
