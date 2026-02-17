use super::*;

pub(crate) fn current_terms() -> Vec<Term> {
  let now = Utc::now().date_naive();

  let (month, year) = (now.month(), now.year() as u16);

  if month >= 8 {
    return vec![
      Term::new(Season::Fall, year),
      Term::new(Season::Winter, year + 1),
      Term::new(Season::Summer, year + 1),
    ];
  }

  vec![
    Term::new(Season::Fall, year - 1),
    Term::new(Season::Winter, year),
    Term::new(Season::Summer, year),
  ]
}
