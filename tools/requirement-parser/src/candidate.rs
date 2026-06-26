use super::*;

#[derive(Debug, Eq, PartialEq)]
pub(super) struct Candidate(String);

impl Display for Candidate {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    f.write_str(&self.0)
  }
}

impl From<&str> for Candidate {
  fn from(course: &str) -> Self {
    let course = course.trim().to_uppercase().replace('-', " ");

    if re::COURSE_CODE.is_match(&course) {
      return Self(course);
    }

    let course = course.replace(' ', "");

    let Some((subject, code)) = course.split_at_checked(4) else {
      return Self(course);
    };

    Self(format!("{subject} {code}"))
  }
}

impl From<&String> for Candidate {
  fn from(course: &String) -> Self {
    Self::from(course.as_str())
  }
}

impl From<String> for Candidate {
  fn from(course: String) -> Self {
    Self::from(course.as_str())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn normalizes_candidates() {
    assert_eq!(
      [
        "FOOO100".to_string(),
        "BARR 200".to_string(),
        "BAZZ-300".to_string(),
      ]
      .iter()
      .map(Candidate::from)
      .collect::<Vec<_>>(),
      vec![
        Candidate("FOOO 100".to_string()),
        Candidate("BARR 200".to_string()),
        Candidate("BAZZ 300".to_string()),
      ],
    );
  }
}
