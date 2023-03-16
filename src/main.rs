use {
  crate::{
    arguments::Arguments, config::Config, db::Db, loader::Loader,
    options::Options, page::Page, server::Server, state::State,
    subcommand::Subcommand, vec_ext::VecExt, vsb_client::VsbClient,
  },
  axum::Router,
  clap::Parser,
  dotenv::dotenv,
  http::Method,
  model::{course::Course, course_listing::CourseListing, schedule::Schedule},
  rayon::prelude::*,
  serde::Deserialize,
  sqlx::{migrate::MigrateDatabase, PgPool, Postgres},
  std::{
    fs, marker::Sized, net::SocketAddr, path::PathBuf, process, str::FromStr,
    thread, time::Duration,
  },
  tower_http::cors::{Any, CorsLayer},
};

mod arguments;
mod config;
mod db;
mod loader;
mod options;
mod page;
mod server;
mod state;
mod subcommand;
mod vec_ext;
mod vsb_client;

type Result<T = (), E = anyhow::Error> = std::result::Result<T, E>;

#[tokio::main]
async fn main() {
  env_logger::init();

  dotenv().ok();

  if let Err(error) = Arguments::parse().run().await {
    eprintln!("error: {error}");
    process::exit(1);
  }
}
