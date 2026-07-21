use super::*;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug)]
pub(super) struct OpenAiClient {
  client: Client<OpenAIConfig>,
  model: String,
}

impl OpenAiClient {
  pub(super) fn new(base_url: &str) -> Result<Self> {
    Ok(Self {
      client: Client::with_config(
        OpenAIConfig::new()
          .with_api_key(
            env::var("OPENAI_API_KEY")
              .context("OpenAI API key not present in environment variables")?,
          )
          .with_api_base(base_url),
      ),
      model: env::var("OPENAI_MODEL_NAME")
        .context("OpenAI model name not present in environment variables")?,
    })
  }

  pub(super) async fn parse_requirement(
    &self,
    requirement: &str,
    candidates: Vec<Candidate>,
  ) -> Result<Option<RequirementNode>> {
    let candidates = candidates
      .into_iter()
      .map(|candidate| candidate.to_string())
      .collect::<Vec<_>>();

    let user_content = format!(
      "Requirement text:\n{requirement}\n\nCandidate courses:\n{}",
      candidates.join(", ")
    );

    let request = CreateChatCompletionRequestArgs::default()
      .model(&self.model)
      .messages([
        ChatCompletionRequestSystemMessageArgs::default()
          .content(PROMPT)
          .build()?
          .into(),
        ChatCompletionRequestUserMessageArgs::default()
          .content(user_content)
          .build()?
          .into(),
      ])
      .response_format(Schema::new(&candidates).response_format())
      .temperature(0.0_f32)
      .build()?;

    let response = timeout(REQUEST_TIMEOUT, self.client.chat().create(request))
      .await
      .context("OpenAI request timed out")?
      .context("failed to send OpenAI request")?;

    let prediction = response
      .choices
      .into_iter()
      .next()
      .and_then(|choice| choice.message.content)
      .context("GPT gave none for message content")?
      .replace('\n', "");

    let response = serde_json::from_str::<Response>(&prediction)
      .context("failed to parse structured requirement response")?;

    match response.requirement {
      Some(requirement) => {
        requirement.validate(&candidates).map_err(Error::msg)
      }
      None => Ok(None),
    }
  }
}
