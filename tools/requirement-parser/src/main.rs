use {
  anyhow::{Context, Error, bail},
  clap::Parser,
  model::{Course, RequirementNode},
  regex::Regex,
  reqwest::blocking::Client,
  scraper::{ElementRef, Html, Selector},
  serde::{Deserialize, Serialize},
  serde_json::{Value, json},
  std::{
    collections::BTreeSet,
    env, fs,
    path::{Path, PathBuf},
    process,
    sync::LazyLock,
    thread,
    time::Duration,
  },
};

mod arguments;
mod re;

const DEFAULT_API_URL: &str = "https://api.openai.com/v1/chat/completions";

const PROMPT: &str = "Parse McGill course requirement text into a course prerequisite expression tree. Use only the candidate course codes supplied by the user. Preserve the logical meaning of and/or phrasing. Return null when the text contains no course-code requirement that can be represented by the candidates.";

#[derive(Debug)]
struct OpenAiClient {
  api_key: String,
  api_url: String,
  client: Client,
  model: String,
}

impl OpenAiClient {
  fn from_env(api_url: &str) -> Result<Self> {
    let api_key = env::var("OPENAI_API_KEY")
      .context("OpenAI API key not present in environment variables")?;

    let model = env::var("OPENAI_MODEL_NAME")
      .context("OpenAI model name not present in environment variables")?;

    Ok(Self {
      api_key,
      api_url: api_url.to_string(),
      client: reqwest::blocking::Client::new(),
      model,
    })
  }

  fn request(
    &self,
    request: &str,
    candidates: &[String],
  ) -> Result<Option<RequirementNode>> {
    let user_content = format!(
      "Requirement text:\n{request}\n\nCandidate courses:\n{}",
      candidates.join(", ")
    );

    let request = ChatCompletionRequest {
      model: &self.model,
      messages: vec![
        ChatCompletionMessage {
          role: "system",
          content: PROMPT.to_string(),
        },
        ChatCompletionMessage {
          role: "user",
          content: user_content,
        },
      ],
      response_format: response_format(candidates),
      temperature: 0,
    };

    let response = self
      .client
      .post(&self.api_url)
      .bearer_auth(&self.api_key)
      .json(&request)
      .send()
      .context("failed to send OpenAI request")?;

    let status = response.status();

    let body = response
      .text()
      .context("failed to read OpenAI response body")?;

    if !status.is_success() {
      bail!("OpenAI request failed with status {status}: {body}");
    }

    let response = serde_json::from_str::<ChatCompletionResponse>(&body)
      .context("failed to parse OpenAI response")?;

    let prediction = response
      .choices
      .into_iter()
      .next()
      .and_then(|choice| choice.message.content)
      .context("GPT gave none for message content")?
      .replace('\n', "");

    println!("Got completion: {prediction}");

    let response = serde_json::from_str::<RequirementResponse>(&prediction)
      .context("failed to parse structured requirement response")?;

    match response.requirement {
      Some(requirement) => requirement.validate(candidates).map_err(Error::msg),
      None => Ok(None),
    }
  }
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest<'a> {
  model: &'a str,
  messages: Vec<ChatCompletionMessage<'a>>,
  response_format: ResponseFormat,
  temperature: u8,
}

#[derive(Debug, Serialize)]
struct ChatCompletionMessage<'a> {
  role: &'a str,
  content: String,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
  #[serde(rename = "type")]
  kind: &'static str,
  json_schema: JsonSchema,
}

#[derive(Debug, Serialize)]
struct JsonSchema {
  name: &'static str,
  strict: bool,
  schema: Value,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
  choices: Vec<ChatCompletionChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionChoice {
  message: ChatCompletionResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponseMessage {
  content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RequirementResponse {
  requirement: Option<RequirementNode>,
}

fn parse_course_req(
  client: &OpenAiClient,
  req: Option<&str>,
  candidates: &[String],
) -> Result<Option<RequirementNode>> {
  let Some(req) = req else {
    return Ok(None);
  };

  if candidates.is_empty() {
    return Ok(None);
  }

  if candidates.len() == 1 {
    return Ok(Some(RequirementNode::Course(candidates[0].clone())));
  }

  if let Some((_, right)) = req.split_once(": ")
    && candidates.iter().any(|candidate| candidate == right)
  {
    return Ok(Some(RequirementNode::Course(right.to_string())));
  }

  client.request(req, candidates)
}

fn parse_requirement_text(
  client: &OpenAiClient,
  course_code: &str,
  field: &str,
  req: Option<&str>,
  courses: &[String],
) -> Result<Option<RequirementNode>> {
  let req = req.with_context(|| format!("{course_code} missing {field}"))?;
  let req = parse_html(req)?;
  let candidates = candidates(courses, &req)?;

  parse_course_req(client, Some(&req), &candidates)
}

fn response_format(candidates: &[String]) -> ResponseFormat {
  ResponseFormat {
    kind: "json_schema",
    json_schema: JsonSchema {
      name: "course_requirement",
      strict: true,
      schema: json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "requirement": {
            "anyOf": [
              { "$ref": "#/$defs/requirementNode" },
              { "type": "null" }
            ]
          }
        },
        "required": ["requirement"],
        "$defs": {
          "course": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "type": { "enum": ["course"] },
              "data": { "type": "string", "enum": candidates }
            },
            "required": ["type", "data"]
          },
          "group": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "type": { "enum": ["group"] },
              "data": { "$ref": "#/$defs/groupData" }
            },
            "required": ["type", "data"]
          },
          "groupData": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "operator": { "enum": ["AND", "OR"] },
              "groups": {
                "type": "array",
                "items": { "$ref": "#/$defs/requirementNode" }
              }
            },
            "required": ["operator", "groups"]
          },
          "requirementNode": {
            "anyOf": [
              { "$ref": "#/$defs/course" },
              { "$ref": "#/$defs/group" }
            ]
          }
        }
      }),
    },
  }
}

fn candidates(courses: &[String], req: &str) -> Result<Vec<String>> {
  let mut candidates = BTreeSet::new();

  for course in courses {
    let course = normalize_course_code(course)
      .with_context(|| format!("invalid course code {course:?}"))?;
    candidates.insert(course);
  }

  for course in re::COURSE_CODE_IN_TEXT.find_iter(req) {
    candidates.insert(course.as_str().to_string());
  }

  Ok(candidates.into_iter().collect())
}

fn normalize_course_code(course: &str) -> Option<String> {
  let course = course.trim().to_uppercase().replace('-', " ");

  if re::COURSE_CODE.is_match(&course) {
    return Some(course);
  }

  let course = course.replace(' ', "");

  if course.len() < 7 {
    return None;
  }

  let (subject, code) = course.split_at(4);

  let course = format!("{subject} {code}");

  re::COURSE_CODE.is_match(&course).then_some(course)
}

fn parse_html(html: &str) -> Result<String> {
  let parsed = Html::parse_fragment(&format!("<div>{html}</div>"));

  let selector = Selector::parse("div").expect("selector should parse");

  let root = parsed
    .select(&selector)
    .next()
    .context("missing root div")?;

  let mut result = String::new();

  for child in root.children() {
    if let Some(element) = ElementRef::wrap(child) {
      if element.value().name() == "a" {
        let href = element.attr("href").context("anchor missing href")?;
        result.push_str(&course_code_from_href(href)?);
      } else {
        result.push_str(&element.text().collect::<String>());
      }
    } else if let Some(text) = child.value().as_text() {
      result.push_str(text);
    }
  }

  Ok(result)
}

fn course_code_from_href(href: &str) -> Result<String> {
  let mut segments = href
    .trim_end_matches('/')
    .split('/')
    .filter(|segment| !segment.is_empty())
    .collect::<Vec<_>>();

  if segments.last() == Some(&"index.html") {
    segments.pop();
  }

  let course = segments
    .last()
    .with_context(|| format!("href {href:?} does not contain a course code"))?;

  Ok(course.to_uppercase().replace('-', " "))
}

fn read_failed(path: &Path) -> Result<Vec<String>> {
  if !path.exists() {
    return Ok(Vec::new());
  }

  Ok(
    fs::read_to_string(path)
      .with_context(|| format!("failed to read {}", path.display()))?
      .lines()
      .map(str::trim)
      .filter(|line| !line.is_empty())
      .map(str::to_string)
      .collect(),
  )
}

fn write_failed(path: &Path, failed: &[String]) -> Result {
  fs::write(path, failed.join("\n"))
    .with_context(|| format!("failed to write {}", path.display()))
}

type Result<T = (), E = Error> = std::result::Result<T, E>;

fn main() {
  if let Err(err) = arguments::Arguments::parse().run() {
    eprintln!("error: {err}");

    let causes = err.chain().skip(1).count();

    for (i, err) in err.chain().skip(1).enumerate() {
      eprintln!("       {}- {err}", if i < causes - 1 { "|" } else { "`" });
    }

    process::exit(1);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn preprocesses_html() {
    assert_eq!(
      parse_html(
        r#"Prerequisites: <a href="https://coursecatalogue.mcgill.ca/courses/fooo-100/index.html">foo</a> and <a href="/courses/barr-200">bar</a>"#,
      )
      .unwrap(),
      "Prerequisites: FOOO 100 and BARR 200",
    );
  }

  #[test]
  fn normalizes_candidates() {
    assert_eq!(
      candidates(
        &[
          "FOOO100".to_string(),
          "BARR 200".to_string(),
          "BAZZ-300".to_string(),
        ],
        "Prerequisites: BARR 200 and QUXY 400",
      )
      .unwrap(),
      vec!["BARR 200", "BAZZ 300", "FOOO 100", "QUXY 400"],
    );
  }
}
