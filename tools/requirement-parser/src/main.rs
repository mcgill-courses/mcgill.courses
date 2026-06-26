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
  clap::Parser,
  dotenv::dotenv,
  model::RequirementNode,
  openai::OpenAiClient,
  regex::Regex,
  schema::{RequirementResponse, RequirementSchema},
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
  tokio::time::sleep,
};

mod arguments;
mod candidate;
mod openai;
mod parser;
mod re;
mod schema;

const DEFAULT_API_BASE: &str = "https://api.openai.com/v1";
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
