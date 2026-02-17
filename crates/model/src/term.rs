use super::*;

#[derive(Clone, Copy, Debug, Default, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub enum Season {
  Winter,
  Summer,
  #[default]
  Fall,
}

impl Display for Season {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    match self {
      Season::Fall => write!(f, "Fall"),
      Season::Winter => write!(f, "Winter"),
      Season::Summer => write!(f, "Summer"),
    }
  }
}

impl FromStr for Season {
  type Err = String;

  fn from_str(value: &str) -> Result<Self, Self::Err> {
    match value {
      "Fall" | "fall" => Ok(Season::Fall),
      "Winter" | "winter" => Ok(Season::Winter),
      "Summer" | "summer" => Ok(Season::Summer),
      _ => Err(format!("invalid season: {value}")),
    }
  }
}

#[derive(Clone, Copy, Debug, Default, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[typeshare(serialized_as = "String")]
pub struct Term {
  pub year: u16,
  pub season: Season,
}

impl Display for Term {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    write!(f, "{} {}", self.season, self.year)
  }
}

impl FromStr for Term {
  type Err = String;

  fn from_str(value: &str) -> Result<Self, Self::Err> {
    let (season_str, year_str) = value
      .split_once(' ')
      .ok_or_else(|| format!("invalid term format: {value}"))?;

    let season = season_str.parse()?;

    let year = year_str
      .parse()
      .map_err(|_| format!("invalid year in term: {value}"))?;

    Ok(Term { season, year })
  }
}

impl Serialize for Term {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    serializer.serialize_str(&self.to_string())
  }
}

impl<'de> Deserialize<'de> for Term {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    String::deserialize(deserializer)?
      .parse()
      .map_err(D::Error::custom)
  }
}

impl From<Term> for Bson {
  fn from(term: Term) -> Self {
    Bson::String(term.to_string())
  }
}

impl ToSchema for Term {
  fn name() -> Cow<'static, str> {
    Cow::Borrowed("Term")
  }
}

impl PartialSchema for Term {
  fn schema() -> RefOr<Schema> {
    Object::builder()
      .schema_type(Type::String)
      .description(Some("Academic term (e.g. 'Fall 2025')"))
      .examples(["Fall 2025", "Winter 2026", "Summer 2025"])
      .into()
  }
}

impl Term {
  pub fn new(season: Season, year: u16) -> Self {
    Self { season, year }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parse_valid_term() {
    assert_eq!(
      "Fall 2025".parse::<Term>().unwrap(),
      Term::new(Season::Fall, 2025)
    )
  }

  #[test]
  fn parse_all_seasons() {
    assert_eq!(
      "Winter 2024".parse::<Term>().unwrap(),
      Term::new(Season::Winter, 2024)
    );

    assert_eq!(
      "Summer 2024".parse::<Term>().unwrap(),
      Term::new(Season::Summer, 2024)
    );

    assert_eq!(
      "Fall 2024".parse::<Term>().unwrap(),
      Term::new(Season::Fall, 2024)
    );
  }

  #[test]
  fn display_term() {
    assert_eq!(Term::new(Season::Fall, 2025).to_string(), "Fall 2025");
  }

  #[test]
  fn roundtrip_serde() {
    let term = Term::new(Season::Winter, 2026);

    let json = serde_json::to_string(&term).unwrap();
    assert_eq!(json, "\"Winter 2026\"");

    assert_eq!(serde_json::from_str::<Term>(&json).unwrap(), term);
  }

  #[test]
  fn parse_invalid_term() {
    assert!("InvalidTerm".parse::<Term>().is_err());
    assert!("Fall".parse::<Term>().is_err());
    assert!("2025".parse::<Term>().is_err());
    assert!("Spring 2025".parse::<Term>().is_err());
  }

  #[test]
  fn ordering() {
    let fall_2024 = Term::new(Season::Fall, 2024);
    let winter_2025 = Term::new(Season::Winter, 2025);
    let summer_2025 = Term::new(Season::Summer, 2025);
    let fall_2025 = Term::new(Season::Fall, 2025);

    assert!(fall_2024 < winter_2025);
    assert!(winter_2025 < summer_2025);
    assert!(summer_2025 < fall_2025);
  }
}
