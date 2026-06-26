use {
  anyhow::{Context, Error},
  arguments::Arguments,
  async_openai::{
    Client,
    config::OpenAIConfig,
    types::chat::{
      ChatCompletionRequestSystemMessageArgs,
      ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs,
      ResponseFormat, ResponseFormatJsonSchema,
    },
  },
  candidate::Candidate,
  clap::Parser as Clap,
  dotenv::dotenv,
  model::RequirementNode,
  openai_client::OpenAiClient,
  parser::Parser,
  progress::Progress,
  regex::Regex,
  response::Response,
  schema::Schema,
  serde::Deserialize,
  serde_json::json,
  std::{
    env,
    fmt::{self, Display, Formatter},
    fs,
    path::PathBuf,
    process,
    sync::LazyLock,
    time::Duration,
  },
  summary::Summary,
  tokio::time::{sleep, timeout},
};

mod arguments;
mod candidate;
mod openai_client;
mod parser;
mod progress;
mod re;
mod response;
mod schema;
mod summary;

const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const PROMPT: &str = include_str!("prompt.txt");

type Result<T = (), E = Error> = std::result::Result<T, E>;

#[tokio::main]
async fn main() {
  if let Err(err) = Arguments::parse().run().await {
    eprintln!("error: {err}");

    let causes = err.chain().skip(1).count();

    for (i, err) in err.chain().skip(1).enumerate() {
      eprintln!("       {}- {err}", if i < causes - 1 { "|" } else { "`" });
    }

    process::exit(1);
  }
}
