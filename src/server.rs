use super::*;

#[derive(Parser)]
pub(crate) struct Server {
  #[clap(long, default_value = "admin")]
  db_name: String,
  #[clap(long, default_value = "8000")]
  port: u16,
  #[clap(long, default_value = "false")]
  seed: bool,
}

impl Server {
  pub(crate) async fn run(self, source: PathBuf) -> Result {
    let addr = SocketAddr::from(([127, 0, 0, 1], self.port));

    log::debug!("Listening on port: {}", addr.port());

    let db = Arc::new(Db::connect(&self.db_name).await?);

    if self.seed {
      let clone = db.clone();

      tokio::spawn(async move {
        if let Err(error) = clone.seed(source).await {
          log::error!("error: {error}");
        }
      });
    }

    axum_server::Server::bind(addr)
      .serve(
        Router::new()
          .route("/auth/authorized", get(auth::login_authorized))
          .route("/auth/login", get(auth::microsoft_auth))
          .route("/auth/logout", get(auth::logout))
          .route("/courses", get(courses::get_courses))
          .route("/courses/:id", get(courses::get_course_by_id))
          .route("/reviews", delete(reviews::delete_review))
          .route("/reviews", get(reviews::get_reviews))
          .route("/reviews", post(reviews::add_review))
          .route("/reviews", put(reviews::update_review))
          .route("/search", get(search::search))
          .route("/user", get(user::get_user))
          .with_state(State::new(db).await)
          .layer(CorsLayer::very_permissive())
          .into_make_service(),
      )
      .await?;

    Ok(())
  }
}
