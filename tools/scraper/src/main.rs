use {
  crate::{loader::Loader, select::Select, vsb_client::VsbClient},
  anyhow::{Error, anyhow, bail},
  chrono::Utc,
  clap::Parser,
  model::{
    Block, Course, CoursePage, Instructor, Requirement, Requirements, Schedule,
    Term, TimeBlock,
  },
  rayon::iter::{IntoParallelRefIterator, ParallelIterator},
  regex::Regex,
  reqwest::StatusCode,
  reqwest::blocking::{Client, RequestBuilder},
  retry::Retry,
  scraper::{ElementRef, Html, Selector},
  std::{
    collections::HashSet,
    env, fs,
    hash::Hash,
    path::PathBuf,
    process,
    process::{Child, Command},
    thread,
    time::Duration,
  },
  thirtyfour::prelude::*,
  tokio::time::sleep,
  totp_rs::{Secret, TOTP},
  tracing::{error, info, warn},
  tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt},
};

mod auth;
mod course_extractor;
mod loader;
mod retry;
mod select;
mod utils;
mod vsb_client;
mod vsb_extractor;

type Result<T = (), E = Error> = std::result::Result<T, E>;

fn run() -> Result {
  tracing_subscriber::registry()
    .with(
      tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info".into()),
    )
    .with(tracing_subscriber::fmt::layer())
    .init();

  Loader::parse().run(&auth::authenticate()?)
}

fn main() {
  if let Err(error) = run() {
    eprintln!("error: {error}");
    process::exit(1);
  }
}
