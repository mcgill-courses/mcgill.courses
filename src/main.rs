use {
  crate::{
    arguments::Arguments,
    config::Config,
    course::{Course, Instructor, Requirement, Requirements, Schedule},
    db::Db,
    extractor::Extractor,
    options::Options,
    select::Select,
    server::Server,
    state::State,
    subcommand::Subcommand,
    vec_ext::VecExt,
  },
  anyhow::anyhow,
  axum::Router,
  clap::Parser,
  dotenv::dotenv,
  http::Method,
  rayon::prelude::*,
  scraper::{ElementRef, Html, Selector},
  serde::{Deserialize, Serialize},
  sqlx::{migrate::MigrateDatabase, PgPool, Postgres},
  std::{
    fs, marker::Sized, net::SocketAddr, path::PathBuf, process, str::FromStr, thread,
    time::Duration,
  },
  tower_http::cors::{Any, CorsLayer},
  uuid::Uuid,
};

mod arguments;
mod config;
mod course;
mod db;
mod extractor;
mod options;
mod select;
mod server;
mod state;
mod subcommand;
mod vec_ext;

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
