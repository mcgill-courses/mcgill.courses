use {
  anyhow::{Context, Error},
  arguments::Arguments,
  clap::Parser,
  course::Course,
  output::Output,
  rayon::prelude::*,
  serde::{Deserialize, Serialize},
  std::{
    collections::{BTreeSet, HashMap},
    fs,
    fs::File,
    io::BufReader,
    path::{Path, PathBuf},
    process,
  },
};

mod arguments;
mod course;
mod output;
mod seed;

fn default_output_path() -> PathBuf {
  repo_root().join("client/src/assets/search-data.json")
}

fn default_seed_path() -> PathBuf {
  repo_root().join("seed")
}

fn repo_root() -> PathBuf {
  Path::new(env!("CARGO_MANIFEST_DIR"))
    .parent()
    .unwrap()
    .parent()
    .unwrap()
    .to_path_buf()
}

type Result<T = (), E = Error> = std::result::Result<T, E>;

fn main() {
  if let Err(err) = Arguments::parse().run() {
    eprintln!("error: {err}");

    let causes = err.chain().skip(1).count();

    for (i, err) in err.chain().skip(1).enumerate() {
      eprintln!("       {}─ {err}", if i < causes - 1 { '├' } else { '└' });
    }

    process::exit(1);
  }
}
