use {
  mockito::{Matcher, Server},
  model::Course,
  serde_json::{Value, json},
  std::{fs, process::Command},
  tempfile::tempdir,
};

#[test]
fn parses_requirements() {
  let tempdir = tempdir().unwrap();

  let course_path = tempdir.path().join("courses.json");

  fs::write(
    &course_path,
    serde_json::to_string_pretty(&vec![
      Course {
        id: "BARR200".to_string(),
        subject: "BARR".to_string(),
        code: "200".to_string(),
        prerequisites_text: Some(
          "Prerequisites: FOOO 100 and BAZZ 300".to_string(),
        ),
        corequisites_text: Some("Corequisite: QUXY 400".to_string()),
        prerequisites: vec!["FOOO100".to_string(), "BAZZ300".to_string()],
        corequisites: vec!["QUXY400".to_string()],
        ..Default::default()
      },
      Course {
        id: "FOOO100".to_string(),
        subject: "FOOO".to_string(),
        code: "100".to_string(),
        ..Default::default()
      },
    ])
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
    .arg("--base-url")
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
    serde_json::to_string_pretty(&vec![
      Course {
        id: "BARR200".to_string(),
        subject: "BARR".to_string(),
        code: "200".to_string(),
        prerequisites_text: Some(
          "Prerequisites: FOOO 100 and BAZZ 300".to_string(),
        ),
        prerequisites: vec!["FOOO100".to_string(), "BAZZ300".to_string()],
        ..Default::default()
      },
      Course {
        id: "FOOO100".to_string(),
        subject: "FOOO".to_string(),
        code: "100".to_string(),
        prerequisites_text: Some("Prerequisite: BAZZ 300".to_string()),
        prerequisites: vec!["BAZZ300".to_string()],
        ..Default::default()
      },
    ])
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
    .arg("--base-url")
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

  assert_eq!(
    output[1]["logicalPrerequisites"],
    json!({
      "type": "course",
      "data": "BAZZ 300",
    }),
  );
}
