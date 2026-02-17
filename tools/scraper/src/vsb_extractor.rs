use super::*;

pub(crate) fn extract_course_schedules(text: &str) -> Result<Vec<Schedule>> {
  let html = Html::parse_fragment(text);

  let err = html
    .root_element()
    .select_single("errors")?
    .select_many("error")?;

  Ok(if err.is_empty() {
    let term = html
      .root_element()
      .select_single("term")?
      .attr("v")
      .and_then(|v| v.parse::<Term>().ok());

    html
      .root_element()
      .select_many("uselection")?
      .into_iter()
      .map(|elem| extract_course_schedule(elem, term))
      .collect::<Result<Vec<Schedule>>>()?
  } else {
    Vec::new()
  })
}

fn extract_course_schedule(
  element: ElementRef,
  term: Option<Term>,
) -> Result<Schedule> {
  let timeblocks = element.select_many("timeblock")?;

  Ok(Schedule {
    blocks: Some(
      element
        .select_many("block")?
        .into_iter()
        .map(|block| {
          Ok(Block {
            campus: block.value().attr("campus").map(utils::str_to_title_case),
            display: block.value().attr("disp").map(String::from),
            location: block.value().attr("location").map(String::from),
            crn: block.value().attr("key").map(String::from),
            timeblocks: Some(
              timeblocks
                .iter()
                .filter(|timeblock| {
                  block
                    .value()
                    .attr("timeblockids")
                    .unwrap_or_default()
                    .split(',')
                    .any(|id| {
                      id == timeblock.value().attr("id").unwrap_or_default()
                    })
                })
                .map(|timeblock| TimeBlock {
                  day: timeblock.value().attr("day").map(String::from),
                  t1: timeblock.value().attr("t1").map(String::from),
                  t2: timeblock.value().attr("t2").map(String::from),
                })
                .collect(),
            ),
            instructors: block
              .value()
              .attr("teacher")
              .and_then(|s| {
                s.split("; ")
                  .map(utils::format_instructor_name)
                  .collect::<Result<Vec<String>>>()
                  .ok()
              })
              .unwrap_or_default(),
          })
        })
        .collect::<Result<Vec<_>>>()?,
    ),
    term,
  })
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
  fn extract_vsb_course_schedules_202509() {
    assert_eq!(
      extract_course_schedules(&get_content("vsb_course_schedules_202509.xml"))
        .unwrap(),
      vec![Schedule {
        blocks: Some(vec![Block {
          campus: Some("Downtown".into()),
          display: Some("Lec 001".into()),
          location: Some("LEA 132".into()),
          timeblocks: Some(vec![
            TimeBlock {
              day: Some("3".into()),
              t1: Some("875".into()),
              t2: Some("955".into()),
            },
            TimeBlock {
              day: Some("5".into()),
              t1: Some("875".into()),
              t2: Some("955".into()),
            }
          ]),
          crn: Some("2411".into()),
          instructors: vec!["Mona Elsaadawy".into(), "Jacob Errington".into()]
        }]),
        term: Some("Fall 2025".parse().unwrap())
      }]
    );
  }
}
