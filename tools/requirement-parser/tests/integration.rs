use {
  mockito::{Matcher, Server},
  serde_json::{Value, json},
  std::{fs, process::Command},
  tempfile::tempdir,
};

fn course(
  id: &str,
  prerequisites_text: Option<&str>,
  corequisites_text: Option<&str>,
  prerequisites: Vec<&str>,
  corequisites: Vec<&str>,
) -> Value {
  json!({
    "_id": id,
    "idNgrams": null,
    "title": "foo",
    "titleNgrams": null,
    "credits": "3",
    "subject": &id[..4],
    "code": &id[4..],
    "url": "foo",
    "department": "foo",
    "faculty": "foo",
    "terms": [],
    "description": "foo",
    "instructors": [],
    "prerequisitesText": prerequisites_text,
    "corequisitesText": corequisites_text,
    "prerequisites": prerequisites,
    "corequisites": corequisites,
    "leadingTo": [],
    "logicalPrerequisites": null,
    "logicalCorequisites": null,
    "restrictions": null,
    "schedule": null,
    "avgRating": 0.0,
    "avgDifficulty": 0.0,
    "reviewCount": 0,
  })
}

#[test]
fn parses_requirements() {
  let tempdir = tempdir().unwrap();

  let course_path = tempdir.path().join("courses.json");

  fs::write(
    &course_path,
    serde_json::to_string_pretty(&json!([
      course(
        "BARR200",
        Some(r#"Prerequisites: <a href="/courses/fooo-100/index.html">foo</a> and <a href="/courses/bazz-300">bar</a>"#),
        Some("Corequisite: QUXY 400"),
        vec!["FOOO100", "BAZZ300"],
        vec!["QUXY400"],
      ),
      course("FOOO100", None, None, vec![], vec![]),
    ]))
    .unwrap(),
  )
  .unwrap();

  let mut server = Server::new();

  let mock = server
    .mock("POST", "/chat/completions")
    .match_header("authorization", "Bearer bar")
    .match_body(Matcher::PartialJson(json!({
      "model": "foo",
      "response_format": {
        "type": "json_schema",
        "json_schema": {
          "name": "course_requirement",
          "strict": true,
        },
      },
    })))
    .with_status(200)
    .with_body(
      json!({
        "choices": [
          {
            "index": 0,
            "message": {
              "role": "assistant",
              "content": serde_json::to_string(&json!({
                "requirement": {
                  "type": "group",
                  "data": {
                    "operator": "AND",
                    "groups": [
                      {
                        "type": "course",
                        "data": "FOOO 100",
                      },
                      {
                        "type": "course",
                        "data": "BAZZ 300",
                      },
                    ],
                  },
                },
              }))
              .unwrap(),
            },
            "finish_reason": "stop",
          },
        ],
        "created": 0,
        "id": "foo",
        "model": "foo",
        "object": "chat.completion",
      })
      .to_string(),
    )
    .expect(1)
    .create();

  let output = Command::new(env!("CARGO_BIN_EXE_requirement-parser"))
    .arg("--delay")
    .arg("0")
    .arg("--api-base")
    .arg(server.url())
    .arg(&course_path)
    .current_dir(tempdir.path())
    .env("OPENAI_API_KEY", "bar")
    .env("OPENAI_MODEL_NAME", "foo")
    .output()
    .unwrap();

  assert!(
    output.status.success(),
    "{}",
    String::from_utf8_lossy(&output.stderr)
  );

  mock.assert();

  let output =
    serde_json::from_str::<Value>(&fs::read_to_string(&course_path).unwrap())
      .unwrap();

  assert_eq!(
    output[0]["logicalPrerequisites"],
    json!({
      "type": "group",
      "data": {
        "operator": "AND",
        "groups": [
          {
            "type": "course",
            "data": "FOOO 100",
          },
          {
            "type": "course",
            "data": "BAZZ 300",
          },
        ],
      },
    }),
  );

  assert_eq!(
    output[0]["logicalCorequisites"],
    json!({
      "type": "course",
      "data": "QUXY 400",
    }),
  );

  assert_eq!(output[1]["logicalPrerequisites"], Value::Null);
}

#[test]
fn continues_after_failure() {
  let tempdir = tempdir().unwrap();

  let course_path = tempdir.path().join("courses.json");

  fs::write(
    &course_path,
    serde_json::to_string_pretty(&json!([
      course(
        "BARR200",
        Some(r#"Prerequisites: <a href="/courses/fooo-100/index.html">foo</a> and <a href="/courses/bazz-300">bar</a>"#),
        None,
        vec!["FOOO100", "BAZZ300"],
        vec![],
      ),
      course("FOOO100", None, None, vec![], vec![]),
    ]))
    .unwrap(),
  )
  .unwrap();

  let mut server = Server::new();

  let mock = server
    .mock("POST", "/chat/completions")
    .with_status(400)
    .with_body("bar")
    .expect(1)
    .create();

  let output = Command::new(env!("CARGO_BIN_EXE_requirement-parser"))
    .arg("--delay")
    .arg("0")
    .arg("--api-base")
    .arg(server.url())
    .arg(&course_path)
    .current_dir(tempdir.path())
    .env("OPENAI_API_KEY", "bar")
    .env("OPENAI_MODEL_NAME", "foo")
    .output()
    .unwrap();

  assert!(
    output.status.success(),
    "{}",
    String::from_utf8_lossy(&output.stderr)
  );

  mock.assert();

  let output =
    serde_json::from_str::<Value>(&fs::read_to_string(&course_path).unwrap())
      .unwrap();

  assert_eq!(output[0]["logicalPrerequisites"], Value::Null);
  assert_eq!(output[1]["logicalPrerequisites"], Value::Null);
}
