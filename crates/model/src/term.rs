use super::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Season {
  // Within the same year, we have winter -> summer -> fall for the academic terms
  // Order of declaration matters for the PartialOrd derive
  Winter,
  Summer,
  Fall,
}

impl Display for Season {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{:?}", self)
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Term {
  // Compare by year then season for PartialOrd derive
  year: u16,
  season: Season,
}

#[derive(Debug, Clone)]
pub struct ParseTermError(String);

impl fmt::Display for ParseTermError {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    write!(f, "Invalid course term '{}'", self.0)
  }
}

impl Term {
  pub fn parse(term: &str) -> Result<Self, ParseTermError> {
    term
      .split_once(' ')
      .and_then(|(season, year)| {
        year.parse::<u16>().ok().and_then(|year| {
          let season = match season {
            "Fall" => Season::Fall,
            "Winter" => Season::Winter,
            "Summer" => Season::Summer,
            _ => return None,
          };
          Some(Term { season, year })
        })
      })
      .ok_or_else(|| ParseTermError(term.to_string()))
  }

  pub fn academic_year_terms(&self) -> Vec<Self> {
    let base_year = match self.season {
      Season::Fall => self.year,
      Season::Winter | Season::Summer => self.year - 1,
    };

    vec![
      Term {
        season: Season::Fall,
        year: base_year,
      },
      Term {
        season: Season::Winter,
        year: base_year + 1,
      },
      Term {
        season: Season::Summer,
        year: base_year + 1,
      },
    ]
  }
}

impl Display for Term {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{} {}", self.season, self.year)
  }
}
