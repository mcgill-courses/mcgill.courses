use {
  anyhow::{Context, Error, bail},
  arguments::Arguments,
  clap::Parser,
  google_sheets4::{
    Sheets, api::ValueRange, hyper_rustls, hyper_util, yup_oauth2,
  },
  hyper_rustls::HttpsConnectorBuilder,
  hyper_util::client::legacy::Client,
  hyper_util::rt::TokioExecutor,
  model::{CourseAverage, Grade},
  serde_json::Value,
  std::{
    fs,
    path::{Path, PathBuf},
    process,
  },
  yup_oauth2::{
    CustomHyperClientBuilder, InstalledFlowAuthenticator,
    InstalledFlowReturnMethod,
  },
};

mod arguments;

const RANGE_NAME: &str = "ResultsSimple!A3:F";
const SCOPE: &str = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SPREADSHEET_ID: &str = "1NGUBQuF8FI6ebna86S1RHpc27srxpMbaSyjipIkr-gk";

fn default_credentials_path() -> PathBuf {
  Path::new(env!("CARGO_MANIFEST_DIR")).join("credentials.json")
}

fn default_output_path() -> PathBuf {
  repo_root().join("seed/course-averages.json")
}

fn default_token_path() -> PathBuf {
  Path::new(env!("CARGO_MANIFEST_DIR")).join("tokencache.json")
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

#[tokio::main]
async fn main() {
  if let Err(err) = Arguments::parse().run().await {
    eprintln!("error: {err}");

    let causes = err.chain().skip(1).count();

    for (i, err) in err.chain().skip(1).enumerate() {
      eprintln!("       {}─ {err}", if i < causes - 1 { '├' } else { '└' });
    }

    process::exit(1);
  }
}
