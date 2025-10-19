use {
  anyhow::{Error, anyhow, bail},
  chrono::NaiveDateTime,
  clap::Parser,
  lopdf::{Document, Object},
  rayon::prelude::*,
  regex::Regex,
  serde::{Deserialize, Serialize},
  std::{collections::BTreeMap, fs, path::PathBuf, process},
};

static IGNORE: &[&[u8]] = &[
  b"Length",
  b"BBox",
  b"FormType",
  b"Matrix",
  b"Type",
  b"XObject",
  b"Subtype",
  b"Filter",
  b"ColorSpace",
  b"Width",
  b"Height",
  b"BitsPerComponent",
  b"Length1",
  b"Length2",
  b"Length3",
  b"PTEX.FileName",
  b"PTEX.PageNumber",
  b"PTEX.InfoDict",
  b"FontDescriptor",
  b"ExtGState",
  b"MediaBox",
  b"Annot",
];

#[derive(Debug, Deserialize, Serialize)]
struct PdfText {
  text: BTreeMap<u32, Vec<String>>,
  errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExamDetails {
  format: String,
  #[serde(rename = "type")]
  exam_type: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  location: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CourseExam {
  id: String,
  section: String,
  exam: ExamDetails,
  start_time: String,
  end_time: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Term {
  term: String,
  exams: Vec<CourseExam>,
}

#[derive(Parser, Debug)]
#[command(
  author,
  version,
  about = "Extract exam schedule data from a PDF file."
)]
struct Arguments {
  /// Path to the source PDF file.
  source: PathBuf,
  /// Term to namespace exams for (e.g. 'Fall 2025', 'Winter 2026')
  #[clap(short, long)]
  term: String,
  /// Path to output JSON file.
  #[clap(short, long, default_value = "client/src/assets/final-exams.json")]
  output: PathBuf,
}

impl Arguments {
  fn run(self) -> Result {
    let text = extract_pdf_text(&self.source)?;

    let parsed_exams = parse_exam_schedule(&text)?;

    let mut terms: Vec<Term> = if self.output.exists() {
      serde_json::from_str(&fs::read_to_string(&self.output)?)?
    } else {
      Vec::new()
    };

    if let Some(existing_term) = terms.iter_mut().find(|t| t.term == self.term)
    {
      existing_term.exams = parsed_exams;
    } else {
      terms.push(Term {
        term: self.term.clone(),
        exams: parsed_exams,
      });
    }

    fs::write(self.output, serde_json::to_string_pretty(&terms)?)?;

    Ok(())
  }
}

fn filter_func(
  object_id: (u32, u16),
  object: &mut Object,
) -> Option<((u32, u16), Object)> {
  if IGNORE.contains(&object.type_name().unwrap_or_default()) {
    return None;
  }

  if let Ok(dictionary) = object.as_dict_mut() {
    dictionary.remove(b"Producer");
    dictionary.remove(b"ModDate");
    dictionary.remove(b"Creator");
    dictionary.remove(b"ProcSet");
    dictionary.remove(b"Procset");
    dictionary.remove(b"XObject");
    dictionary.remove(b"MediaBox");
    dictionary.remove(b"Annots");

    if dictionary.is_empty() {
      return None;
    }
  }

  Some((object_id, object.to_owned()))
}

fn get_pdf_text(doc: &Document) -> Result<PdfText, Error> {
  let mut pdf_text = PdfText {
    text: BTreeMap::new(),
    errors: Vec::new(),
  };

  let results = doc
    .get_pages()
    .into_par_iter()
    .map(|(page_num, _page_id)| {
      doc
        .extract_text(&[page_num])
        .map(|text| {
          (
            page_num,
            text
              .split('\n')
              .map(|line| line.trim_end().to_string())
              .collect::<Vec<_>>(),
          )
        })
        .map_err(|err| {
          anyhow!("Failed to extract text from page {page_num}: {err}")
        })
    })
    .collect::<Vec<Result<(u32, Vec<String>), Error>>>();

  for result in results {
    match result {
      Ok((page_num, lines)) => {
        pdf_text.text.insert(page_num, lines);
      }
      Err(err) => pdf_text.errors.push(err.to_string()),
    }
  }

  Ok(pdf_text)
}

fn extract_pdf_text(source: &PathBuf) -> Result<PdfText> {
  let doc = Document::load_filtered(source, filter_func)?;

  let text = get_pdf_text(&doc)?;

  if !text.errors.is_empty() {
    eprintln!(
      "{} produced {} errors:",
      source.display(),
      text.errors.len()
    );

    for error in text.errors.iter().take(10) {
      eprintln!("{error}");
    }
  }

  Ok(text)
}

fn parse_exam_schedule(text: &PdfText) -> Result<Vec<CourseExam>> {
  let course_pattern = Regex::new(r"^[A-Z0-9]{3,5}\s+[0-9]{3}[A-Z0-9]*$")?;

  let section_pattern = Regex::new(r"^[0-9]{3}[A-Z0-9]*$")?;

  let exam_formats = ["IN-PERSON", "ONLINE"];

  let mut lines: Vec<&str> = Vec::new();

  for (_page, page_lines) in &text.text {
    for line in page_lines {
      lines.push(line);
    }
  }

  let mut exams = Vec::new();
  let mut index = 0;

  while index < lines.len() {
    let line = lines[index].trim();

    if !course_pattern.is_match(line) {
      index += 1;
      continue;
    }

    let course_id = line.replace(' ', "");

    let section_line = lines
      .get(index + 1)
      .ok_or_else(|| anyhow!("Missing section for course {course_id}"))?;

    if !section_pattern.is_match(section_line.trim()) {
      bail!("Invalid section \"{section_line}\" for {course_id}");
    }

    let mut title_index = index + 2;

    while title_index < lines.len() {
      let candidate = lines[title_index].trim();

      let first = candidate.split(" - ").next().unwrap_or_default();

      if exam_formats.contains(&first) {
        break;
      }

      title_index += 1;
    }

    if title_index >= lines.len() {
      bail!("Missing exam details for {course_id}");
    }

    if title_index == index + 2 {
      bail!("Missing title for {course_id}");
    }

    let exam_line = lines[title_index].trim();

    let start_line = lines
      .get(title_index + 1)
      .ok_or_else(|| anyhow!("Missing start time for {course_id}"))?;

    let end_line = lines
      .get(title_index + 2)
      .ok_or_else(|| anyhow!("Missing end time for {course_id}"))?;

    let exam = parse_exam_details(exam_line)?;

    let start_time = parse_datetime(start_line).ok_or_else(|| {
      anyhow!("Unrecognized start time \"{start_line}\" for {course_id}")
    })?;

    let end_time = parse_datetime(end_line).ok_or_else(|| {
      anyhow!("Unrecognized end time \"{end_line}\" for {course_id}")
    })?;

    exams.push(CourseExam {
      id: course_id,
      section: section_line.trim().to_string(),
      exam,
      start_time,
      end_time,
    });

    index = title_index + 3;
  }

  Ok(exams)
}

fn parse_exam_details(line: &str) -> Result<ExamDetails, Error> {
  let parts = line.split(" - ").map(str::trim).collect::<Vec<_>>();

  if parts.len() < 2 {
    bail!("Invalid exam line \"{line}\"")
  }

  let format = parts[0].to_string();

  let exam_type = parts[1].to_string();

  let location = if parts.len() > 2 {
    let joined = parts[2..].join(" - ");

    if joined.is_empty() {
      None
    } else {
      Some(joined)
    }
  } else {
    None
  };

  Ok(ExamDetails {
    format,
    exam_type,
    location,
  })
}

fn parse_datetime(value: &str) -> Option<String> {
  NaiveDateTime::parse_from_str(value.trim(), "%d-%b-%Y at %I:%M %p")
    .ok()
    .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string())
}

type Result<T = (), E = Error> = std::result::Result<T, E>;

fn main() {
  if let Err(error) = Arguments::parse().run() {
    eprintln!("error: {error}");
    process::exit(1);
  }
}
