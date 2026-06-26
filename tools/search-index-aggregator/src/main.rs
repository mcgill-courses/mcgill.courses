use {
  anyhow::{Context, Error},
  clap::Parser,
  serde::{Deserialize, Serialize},
  std::{
    collections::{BTreeSet, HashMap},
    fs,
    fs::File,
    io::BufReader,
    path::{Path, PathBuf},
    process,
  },
};

#[derive(Debug, Deserialize)]
struct SeedCourse {
  #[serde(rename = "_id")]
  id: String,
  title: String,
  #[serde(default)]
  terms: Vec<String>,
  instructors: Vec<SeedInstructor>,
}

#[derive(Debug, Deserialize)]
struct SeedInstructor {
  name: String,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
struct Course {
  id: String,
  title: String,
  terms: Vec<String>,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
struct SearchData {
  courses: Vec<Course>,
  instructors: Vec<String>,
}

#[derive(Parser, Debug)]
#[command(
  author,
  version,
  about = "Aggregate course data from seed files and export to JSON."
)]
struct Arguments {
  #[arg(
    short,
    long,
    default_value_os_t = default_seed_path(),
    help = "Path to the directory containing seed files."
  )]
  seed_path: PathBuf,
  #[arg(
    short,
    long,
    default_value_os_t = default_output_path(),
    help = "Path to the output JSON file."
  )]
  output_path: PathBuf,
}

impl Arguments {
  fn run(self) -> Result {
    let mut data_paths = fs::read_dir(&self.seed_path)
      .with_context(|| format!("failed to read {}", self.seed_path.display()))?
      .map(|entry| entry.map(|entry| entry.path()))
      .collect::<std::io::Result<Vec<_>>>()
      .with_context(|| format!("failed to read {}", self.seed_path.display()))?
      .into_iter()
      .filter(|path| path.is_file())
      .filter(|path| {
        path
          .file_name()
          .and_then(|name| name.to_str())
          .is_some_and(|name| {
            name.starts_with("courses-") && name.ends_with(".json")
          })
      })
      .collect::<Vec<_>>();

    data_paths.sort();

    let mut course_ids = Vec::new();

    let (mut courses, mut instructors) = (HashMap::new(), BTreeSet::new());

    for path in data_paths {
      let file = File::open(&path)
        .with_context(|| format!("failed to open {}", path.display()))?;

      let seed_courses =
        serde_json::from_reader::<_, Vec<SeedCourse>>(BufReader::new(file))
          .with_context(|| format!("failed to parse {}", path.display()))?;

      for course in seed_courses {
        let SeedCourse {
          id,
          title,
          terms,
          instructors: seed_instructors,
        } = course;

        if !courses.contains_key(&id) {
          course_ids.push(id.clone());
        }

        courses.insert(id.clone(), Course { id, title, terms });

        for instructor in seed_instructors {
          instructors.insert(instructor.name);
        }
      }
    }

    let courses = course_ids
      .iter()
      .map(|id| {
        courses
          .remove(id)
          .expect("course ID should have matching course data")
      })
      .collect::<Vec<Course>>();

    let output = serde_json::to_string_pretty(&SearchData {
      courses,
      instructors: instructors.into_iter().collect(),
    })?;

    fs::write(&self.output_path, output).with_context(|| {
      format!("failed to write {}", self.output_path.display())
    })?;

    println!("Output written to {}", self.output_path.display());

    Ok(())
  }
}

fn repo_root() -> PathBuf {
  Path::new(env!("CARGO_MANIFEST_DIR"))
    .parent()
    .unwrap()
    .parent()
    .unwrap()
    .to_path_buf()
}

fn default_seed_path() -> PathBuf {
  repo_root().join("seed")
}

fn default_output_path() -> PathBuf {
  repo_root().join("client/src/assets/search-data.json")
}

fn run() -> Result {
  Arguments::parse().run()
}

type Result<T = (), E = Error> = std::result::Result<T, E>;

fn main() {
  if let Err(error) = run() {
    eprintln!("error: {error}");
    process::exit(1);
  }
}

#[cfg(test)]
mod tests {
  use {super::*, tempfile::tempdir};

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

    Arguments {
      seed_path: tempdir.path().to_path_buf(),
      output_path: output_path.clone(),
    }
    .run()
    .unwrap();

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
        "}\n"
      )
    );
  }
}
