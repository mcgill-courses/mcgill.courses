use {
  anyhow::{Context, Error},
  arguments::Arguments,
  clap::Parser,
  rayon::prelude::*,
  serde::{Deserialize, Serialize},
  std::{
    backtrace::BacktraceStatus,
    collections::{BTreeSet, HashMap},
    fs,
    fs::File,
    io::BufReader,
    path::{Path, PathBuf},
    process,
  },
};

mod arguments;
mod seed;

#[derive(Debug, Eq, PartialEq, Serialize)]
struct Course {
  id: String,
  title: String,
  terms: Vec<String>,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
struct SearchData {
  courses: Vec<Course>,
  instructors: Vec<String>,
}

type Result<T = (), E = Error> = std::result::Result<T, E>;

fn main() {
  if let Err(error) = Arguments::parse().run() {
    eprintln!("error: {error}");

    for (i, error) in error.chain().skip(1).enumerate() {
      if i == 0 {
        eprintln!();
        eprintln!("because:");
      }

      eprintln!("- {error}");
    }

    let backtrace = error.backtrace();

    if backtrace.status() == BacktraceStatus::Captured {
      eprintln!("backtrace:");
      eprintln!("{backtrace}");
    }

    process::exit(1);
  }
}
