use super::*;

pub(crate) fn escape_all(patterns: &[String]) -> String {
  patterns
    .iter()
    .map(|pattern| regex::escape(pattern))
    .collect::<Vec<String>>()
    .join("|")
}

pub(crate) fn current_terms() -> Vec<String> {
  let now = Utc::now().date_naive();

  let (month, year) = (now.month(), now.year());

  if month >= 8 {
    return vec![
      format!("Fall {year}"),
      format!("Winter {}", year + 1),
      format!("Summer {}", year + 1),
    ];
  }

  vec![
    format!("Fall {}", year - 1),
    format!("Winter {year}"),
    format!("Summer {year}"),
  ]
}
