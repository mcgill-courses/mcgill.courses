use {
  std::{fs, process::Command},
  tempfile::tempdir,
};

#[test]
fn fetches_course_averages_from_source() {
  let tempdir = tempdir().unwrap();

  let source_path = tempdir.path().join("source.json");
  let output_path = tempdir.path().join("course-averages.json");

  fs::write(
    &source_path,
    r#"{
      "values": [
        ["foo", "FOO100", "F2024", "B+"],
        ["bar", "BAR200", "W2025", "A-"],
        ["baz", "BAZ300", "S2025", "C"]
      ]
    }"#,
  )
  .unwrap();

  let output = Command::new(env!("CARGO_BIN_EXE_course-average-fetcher"))
    .arg("--source-path")
    .arg(&source_path)
    .arg("--output-path")
    .arg(&output_path)
    .output()
    .unwrap();

  assert!(
    output.status.success(),
    "{}",
    String::from_utf8_lossy(&output.stderr)
  );

  let output = fs::read_to_string(output_path).unwrap();

  assert_eq!(
    output,
    concat!(
      "[\n",
      "  {\n",
      "    \"courseId\": \"FOO100\",\n",
      "    \"term\": \"Fall 2024\",\n",
      "    \"average\": \"B+\"\n",
      "  },\n",
      "  {\n",
      "    \"courseId\": \"BAR200\",\n",
      "    \"term\": \"Winter 2025\",\n",
      "    \"average\": \"A-\"\n",
      "  },\n",
      "  {\n",
      "    \"courseId\": \"BAZ300\",\n",
      "    \"term\": \"Summer 2025\",\n",
      "    \"average\": \"C\"\n",
      "  }\n",
      "]"
    )
  );
}

#[test]
fn rejects_invalid_source_rows() {
  #[track_caller]
  fn case(source: &str, expected: &str) {
    let tempdir = tempdir().unwrap();

    let source_path = tempdir.path().join("source.json");
    let output_path = tempdir.path().join("course-averages.json");

    fs::write(&source_path, source).unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_course-average-fetcher"))
      .arg("--source-path")
      .arg(&source_path)
      .arg("--output-path")
      .arg(&output_path)
      .output()
      .unwrap();

    assert!(!output.status.success());

    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(stderr.contains(expected), "{stderr}");
  }

  case(
    r#"{ "values": [["foo", "FOO100", "F2024"]] }"#,
    "missing average in row 3",
  );

  case(
    r#"{ "values": [["foo", "FOO100", "foo", "B"]] }"#,
    "incorrect term format: foo",
  );

  case(
    r#"{ "values": [["foo", "FOO100", "F2024", "bar"]] }"#,
    "invalid average \"bar\" in row 3",
  );
}
