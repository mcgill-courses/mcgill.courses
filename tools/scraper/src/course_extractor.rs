use super::*;

pub fn extract_course_page(text: &str) -> Result<CoursePage> {
  let page = Html::parse_fragment(text);

  let element = page.root_element();

  let full_title = element
    .select_single("h1.page-title")?
    .inner_html()
    .trim()
    .to_owned();

  let parts = full_title
    .split(".")
    .filter(|x| !x.trim().is_empty())
    .collect::<Vec<&str>>();

  if parts.len() < 2 {
    bail!("Failed to parse course title");
  }

  let full_code = parts[0].trim();

  let (_, title_part) = full_title
    .split_once(".")
    .ok_or_else(|| anyhow!("Failed to parse course title"))?;

  let title = title_part.trim().trim_matches('.').trim().to_owned();

  let parts: Vec<&str> = full_code.split(" ").collect();

  if parts.len() < 2 {
    bail!("Failed to parse course code");
  }

  let subject = parts[0].trim().to_owned();

  let code = parts[1].trim().to_owned();

  let credits = element
    .select_single(".detail-credits .value")?
    .inner_html()
    .trim()
    .to_owned();

  // Course might not have a description.
  let description = element
    .select_single(".section--description div.section__content")
    .map(|elem| elem.inner_html().trim().to_owned())
    .unwrap_or_default();

  // Terms may or may not exist, if they don't then just fall back to an empty vec.
  let terms = element
    .select_single(".detail-terms_offered .value")
    .map(|elem| {
      elem
        .inner_html()
        .split(",")
        .map(|term| term.trim().to_owned())
        .collect::<Vec<_>>()
    })
    .unwrap_or_default();

  // Offered by is in the format: <department> (<faculty>).
  let pattern = Regex::new(r"^(.*) \((.*)\)$")?;

  let offered_by = element
    .select_single(".detail-offered_by .value")
    .ok()
    .and_then(|elem| {
      let offered_by = elem.inner_html();
      let captures = pattern.captures(&offered_by)?;
      Some((captures[1].to_string(), captures[2].to_string()))
    });

  // TODO: Extract instructors when they're available.
  //
  // We currently rely on vsb to populate instructors in `Loader`.
  //
  // We'll also need to update the fixtures in `/fixtures/`.
  let instructors = Vec::new();

  Ok(CoursePage {
    title,
    credits,
    subject,
    code,
    terms,
    description,
    department: offered_by.as_ref().map(|x| x.0.clone()),
    faculty: offered_by.as_ref().map(|x| x.1.clone()),
    instructors,
    requirements: extract_course_requirements(&element)?,
  })
}

fn extract_course_requirements(element: &ElementRef) -> Result<Requirements> {
  let notes = element.select_optional("div.detail-note_text ul")?;

  let mut requirements = Requirements::default();

  if let Some(notes) = notes {
    let mut paragraphs = Vec::new();

    for note in notes.select_many("li")? {
      if let Some(paragraph) = note.select_optional("p")? {
        paragraphs.push(paragraph);
      } else {
        paragraphs.push(note);
      }
    }

    for paragraph in paragraphs {
      for title in ["Prerequisite", "Corequisite", "Restriction"].iter() {
        if paragraph.inner_html().starts_with(title) {
          match Requirement::from(*title) {
            Requirement::Prerequisites => {
              requirements.set_prerequisites_text(Some(paragraph.inner_html()));
              requirements
                .set_prerequisites(utils::get_course_codes(&paragraph)?);
            }
            Requirement::Corequisites => {
              requirements.set_corequisites_text(Some(paragraph.inner_html()));
              requirements
                .set_corequisites(utils::get_course_codes(&paragraph)?);
            }
            Requirement::Restrictions => {
              requirements.set_restrictions(utils::get_text(&paragraph));
            }
            Requirement::Unknown => {
              return Err(anyhow!("Unknown requirement type"));
            }
          }
        }
      }
    }
  }

  Ok(requirements)
}

pub fn extract_course_urls(text: &str) -> Result<Vec<String>> {
  let page = Html::parse_fragment(text);

  let selector = Selector::parse("#textcontainer li a").unwrap();

  Ok(
    page
      .select(&selector)
      .filter_map(|elem| elem.attr("href").map(|x| x.to_string()))
      .collect(),
  )
}

#[cfg(test)]
mod tests {
  use {
    super::*,
    include_dir::{Dir, include_dir},
    pretty_assertions::assert_eq,
  };

  static MOCK_DIR: Dir<'_> = include_dir!("tools/scraper/fixtures");

  fn get_content(name: &str) -> String {
    MOCK_DIR
      .get_file(name)
      .unwrap()
      .contents_utf8()
      .unwrap()
      .to_string()
  }

  #[test]
  fn extract_catalog_course_urls_2025_2026() {
    assert_eq!(
      extract_course_urls(&get_content("catalog_all_courses.html")).unwrap(),
      vec![
        "https://coursecatalogue.mcgill.ca/courses/aaaa-100/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-351/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-352/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-354/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-361/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-362/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-385/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-401/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-434/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-451/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-452/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-453/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-455/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-463/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-475/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-486/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-604/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-605/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-618/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-623/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-626/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-645/index.html"
          .to_string(),
        "https://coursecatalogue.mcgill.ca/courses/acct-645d1/index.html"
          .to_string(),
      ]
    );
  }

  #[test]
  fn extract_catalog_course_page_2025_2026() {
    assert_eq!(
      extract_course_page(
        &get_content("catalog_course_page_2025_2026.html"),
      )
      .unwrap(),
      CoursePage {
        title: "Algorithms and Data Structures".into(),
        credits: "3".into(),
        subject: "COMP".into(),
        code: "251".into(),
        terms: vec![],
        department: Some("Computer Science".into()),
        faculty: Some("Faculty of Science".into()),
        description: "Data Structures: priority queues, balanced binary search trees, hash tables, graphs. Algorithms: topological sort, connected components, shortest paths, minimum spanning trees, bipartite matching, network flows. Algorithm design: greedy, divide and conquer, dynamic programming, randomization. Mathematicaltools: proofs of asymptotic complexity and program correctness, Master theorem.".into(),
        instructors: vec![],
        requirements: Requirements {
          prerequisites_text: Some("Prerequisites: COMP 250; MATH 235 or MATH 240".into()),
          prerequisites: vec!["COMP250".into(), "MATH235".into(), "MATH240".into()],
          restrictions: Some("Not open to students who have taken or are taking: COMP 252 or COMP 260.".into()),
          ..Requirements::default()
        }
      }
    );
  }

  #[test]
  fn extract_catalog_course_page_2025_2026_with_terms() {
    assert_eq!(
      extract_course_page(&get_content(
        "catalog_course_page_2025_2026_with_terms.html"
      ),)
      .unwrap(),
      CoursePage {
        title: "Academic Integrity Tutorial".into(),
        credits: "0".into(),
        subject: "AAAA".into(),
        code: "100".into(),
        terms: vec!["Fall 2025".into(), "Winter 2026".into()],
        department: Some("Student Services".into()),
        faculty: Some("No College Designated".into()),
        description: "".into(),
        instructors: vec![],
        requirements: Requirements::default()
      }
    );
  }
}
