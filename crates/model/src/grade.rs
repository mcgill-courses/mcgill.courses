use super::*;

/// Letter grade values used for course averages.
#[derive(
  Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, ToSchema,
)]
#[typeshare]
pub enum Grade {
  #[default]
  A,
  #[serde(rename = "A-")]
  AMinus,
  #[serde(rename = "B+")]
  BPlus,
  B,
  #[serde(rename = "B-")]
  BMinus,
  #[serde(rename = "C+")]
  CPlus,
  C,
  #[serde(rename = "C-")]
  CMinus,
  D,
  F,
}

impl Display for Grade {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    match self {
      Self::A => write!(f, "A"),
      Self::AMinus => write!(f, "A-"),
      Self::BPlus => write!(f, "B+"),
      Self::B => write!(f, "B"),
      Self::BMinus => write!(f, "B-"),
      Self::CPlus => write!(f, "C+"),
      Self::C => write!(f, "C"),
      Self::CMinus => write!(f, "C-"),
      Self::D => write!(f, "D"),
      Self::F => write!(f, "F"),
    }
  }
}
