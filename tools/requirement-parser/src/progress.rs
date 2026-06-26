use super::*;

#[derive(Debug)]
pub(super) struct Progress<'a> {
  pub(super) current: usize,
  pub(super) total: usize,
  pub(super) course: &'a str,
}

impl Display for Progress<'_> {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    let width = self.total.max(1).to_string().len();

    write!(
      f,
      "[{:>width$}/{}] {}",
      self.current, self.total, self.course
    )
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn display() {
    assert_eq!(
      Progress {
        current: 7,
        total: 123,
        course: "FOOO100",
      }
      .to_string(),
      "[  7/123] FOOO100",
    );
  }
}
