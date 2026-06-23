use {
  anyhow::{Error, anyhow},
  async_openai::types::chat::{
    ChatCompletionRequestSystemMessageArgs, CreateChatCompletionRequestArgs,
  },
  chrono::{DateTime, Utc},
  clap::Parser,
  dotenv::dotenv,
  octocrab::{models, params},
  serde::{Deserialize, Serialize},
  std::{
    cmp::Reverse,
    collections::HashMap,
    fmt::Display,
    fs::{self, File},
    path::PathBuf,
    process,
  },
  tracing::info,
  tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt},
  typeshare::typeshare,
};

const BASE_URL: &str = "https://github.com";

#[derive(Debug)]
struct PullRequest<'a> {
  title: Option<&'a str>,
  description: Option<&'a str>,
  number: u64,
  merged_at: Option<DateTime<Utc>>,
  user: &'a str,
  repository: &'a str,
}

impl Display for PullRequest<'_> {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.title.unwrap_or_default())
  }
}

impl PullRequest<'_> {
  async fn summary(&self) -> Result<Option<String>> {
    info!("Generating summary for pull request #{}", self.number);

    if self.title.is_none() && self.description.is_none() {
      return Ok(None);
    }

    let client = async_openai::Client::new();

    let mut prompt = String::new();

    prompt.push_str(include_str!("../prompt.txt"));

    if let Some(title) = self.title {
      prompt.push_str(&format!("\nTitle of the pull request: {title}\n"));
    }

    if let Some(description) = self.description {
      prompt.push_str(&format!(
        "Description of the pull request: {description}\n",
      ));
    }

    let response = client
      .chat()
      .create(
        CreateChatCompletionRequestArgs::default()
          .max_tokens(512u16)
          .model("gpt-3.5-turbo")
          .messages([ChatCompletionRequestSystemMessageArgs::default()
            .content(prompt)
            .build()?
            .into()])
          .build()?,
      )
      .await?;

    let summary = response
      .choices
      .first()
      .ok_or(anyhow!("No choices in response"))?
      .message
      .content
      .as_ref()
      .ok_or(anyhow!("No content in message"))?
      .trim()
      .to_string();

    info!("Generated: {summary}");

    Ok(Some(summary))
  }

  fn url(self) -> Result<String> {
    Ok(format!(
      "{}/{}/{}/pull/{}",
      BASE_URL, self.user, self.repository, self.number
    ))
  }
}

#[derive(Clone, Debug, Serialize, Deserialize, Eq, Hash, PartialEq)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct ChangelogItem {
  pub number: u32,
  pub summary: Option<String>,
  pub url: String,
  #[serde(alias = "merged_at")]
  #[typeshare(serialized_as = "String")]
  pub merged_at: DateTime<Utc>,
}

impl ChangelogItem {
  async fn try_from(
    pull_request: PullRequest<'_>,
    merged_at: DateTime<Utc>,
    number: u32,
  ) -> Result<ChangelogItem> {
    Ok(ChangelogItem {
      number,
      summary: pull_request.summary().await?,
      url: pull_request.url()?,
      merged_at,
    })
  }
}

type Entry = HashMap<String, Vec<ChangelogItem>>;

#[derive(Parser)]
struct Arguments {
  #[clap(long, default_value = "../../client/src/assets/changelog.json")]
  output: PathBuf,
  #[clap(long, value_delimiter = ' ', num_args = 0..)]
  regenerate: Vec<u32>,
  #[clap(long, default_value = "false")]
  regenerate_all: bool,
  #[clap(long, default_value = "mcgill.courses")]
  repo: String,
  #[clap(long, default_value = "terror")]
  user: String,
}

impl Arguments {
  fn pull_request<'a>(
    &'a self,
    pull_request: &'a models::pulls::PullRequest,
  ) -> Option<PullRequest<'a>> {
    Some(PullRequest {
      title: pull_request.title.as_deref(),
      description: pull_request.body.as_deref(),
      number: pull_request.number?,
      merged_at: pull_request.merged_at,
      user: &self.user,
      repository: &self.repo,
    })
  }

  async fn run(&self) -> Result {
    let client = octocrab::instance();

    let page = client
      .pulls(&self.user, &self.repo)
      .list()
      .state(params::State::All)
      .per_page(50)
      .send()
      .await?;

    let model = client.all_pages::<models::pulls::PullRequest>(page).await?;

    info!("Reading existing entries from {}", self.output.display());

    if !self.output.exists() {
      File::create(&self.output)?;
    }

    let content = fs::read_to_string(&self.output)?;

    let existing_items = serde_json::from_str::<Entry>(&content)
      .map(|entry| {
        entry
          .into_values()
          .flat_map(|value| value.into_iter().map(|item| (item.number, item)))
          .collect::<HashMap<u32, ChangelogItem>>()
      })
      .unwrap_or_else(|_| HashMap::<u32, ChangelogItem>::new());

    let pull_requests = model
      .iter()
      .filter_map(|pull_request| self.pull_request(pull_request))
      .collect::<Vec<_>>();

    let mut grouped: Entry = HashMap::new();

    for pull_request in pull_requests {
      if let Some(merged_at) = pull_request.merged_at {
        let number = u32::try_from(pull_request.number).map_err(|_| {
          anyhow!("pull request number {} exceeds u32", pull_request.number)
        })?;

        let month = merged_at.format("%B %Y").to_string();

        if let Some(item) = existing_items.get(&number) {
          if self.regenerate_all || self.regenerate.contains(&number) {
            grouped.entry(month).or_default().push(
              ChangelogItem::try_from(pull_request, merged_at, number).await?,
            );
          } else {
            grouped.entry(month).or_default().push(item.clone());
          }
        } else {
          grouped.entry(month).or_default().push(
            ChangelogItem::try_from(pull_request, merged_at, number).await?,
          );
        }
      }
    }

    if !grouped.is_empty() {
      info!("Writing to {}", self.output.display());

      for items in grouped.values_mut() {
        items.sort_by_key(|item| Reverse(item.merged_at));
      }

      fs::write(&self.output, serde_json::to_string_pretty(&grouped)?)?;
    }

    info!("Generated changelog successfully");

    Ok(())
  }
}

type Result<T = (), E = Error> = std::result::Result<T, E>;

#[tokio::main]
async fn main() {
  tracing_subscriber::registry()
    .with(
      tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info".into()),
    )
    .with(tracing_subscriber::fmt::layer())
    .init();

  dotenv().ok();

  if let Err(error) = Arguments::parse().run().await {
    eprintln!("error: {error}");
    process::exit(1);
  }
}

#[cfg(test)]
mod tests {
  use {super::*, serde_json::json};

  fn arguments() -> Arguments {
    Arguments {
      output: "foo".into(),
      regenerate: Vec::new(),
      regenerate_all: false,
      repo: "bar".to_string(),
      user: "baz".to_string(),
    }
  }

  fn pull_request_model(number: Option<u64>) -> models::pulls::PullRequest {
    serde_json::from_value(json!({
      "body": "bar",
      "merged_at": "2026-01-02T03:04:05Z",
      "number": number,
      "title": "foo",
    }))
    .unwrap()
  }

  #[test]
  fn pull_request() {
    let arguments = arguments();
    let model = pull_request_model(Some(1));

    let pull_request = arguments.pull_request(&model).unwrap();

    assert_eq!(pull_request.title, Some("foo"));
    assert_eq!(pull_request.description, Some("bar"));
    assert_eq!(pull_request.number, 1);
    assert_eq!(pull_request.user, "baz");
    assert_eq!(pull_request.repository, "bar");
    assert!(pull_request.merged_at.is_some());

    let model = pull_request_model(None);

    assert!(arguments.pull_request(&model).is_none());
  }
}
