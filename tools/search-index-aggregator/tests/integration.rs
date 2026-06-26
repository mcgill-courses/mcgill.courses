use {
  std::{fs, process::Command},
  tempfile::tempdir,
};

#[test]
fn aggregates_search_data() {
  let tempdir = tempdir().unwrap();

  fs::write(
    tempdir.path().join("courses-2024-2025.json"),
    r#"[
      {
        "_id": "FOOO100",
        "title": "foo",
        "terms": ["Fall 2024"],
        "instructors": [
          { "name": "bar" },
          { "name": "foo" }
        ]
      },
      {
        "_id": "BARR200",
        "title": "bar",
        "instructors": [
          { "name": "baz" }
        ]
      }
    ]"#,
  )
  .unwrap();

  fs::write(
    tempdir.path().join("courses-2025-2026.json"),
    r#"[
      {
        "_id": "FOOO100",
        "title": "baz",
        "terms": ["Winter 2026"],
        "instructors": [
          { "name": "qux" }
        ]
      },
      {
        "_id": "BAZZ300",
        "title": "qux",
        "terms": [],
        "instructors": []
      }
    ]"#,
  )
  .unwrap();

  fs::write(
    tempdir.path().join("reviews.json"),
    r#"[{ "_id": "NOPE100", "title": "foo", "instructors": [] }]"#,
  )
  .unwrap();

  let output_path = tempdir.path().join("search-data.json");

  let output = Command::new(env!("CARGO_BIN_EXE_search-index-aggregator"))
    .arg("--seed-path")
    .arg(tempdir.path())
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
      "{\n",
      "  \"courses\": [\n",
      "    {\n",
      "      \"id\": \"FOOO100\",\n",
      "      \"title\": \"baz\",\n",
      "      \"terms\": [\n",
      "        \"Winter 2026\"\n",
      "      ]\n",
      "    },\n",
      "    {\n",
      "      \"id\": \"BARR200\",\n",
      "      \"title\": \"bar\",\n",
      "      \"terms\": []\n",
      "    },\n",
      "    {\n",
      "      \"id\": \"BAZZ300\",\n",
      "      \"title\": \"qux\",\n",
      "      \"terms\": []\n",
      "    }\n",
      "  ],\n",
      "  \"instructors\": [\n",
      "    \"bar\",\n",
      "    \"baz\",\n",
      "    \"foo\",\n",
      "    \"qux\"\n",
      "  ]\n",
      "}"
    )
  );
}
