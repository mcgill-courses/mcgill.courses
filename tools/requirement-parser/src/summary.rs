use super::*;

#[derive(Debug, Default)]
pub(super) struct Summary {
  pub(super) failed: usize,
  pub(super) skipped_existing: usize,
  pub(super) skipped_without_requirements: usize,
  pub(super) updated: usize,
}

impl Display for Summary {
  fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
    write!(
      f,
      "{} updated, {} skipped without requirements, {} skipped already parsed, {} failed",
      self.updated,
      self.skipped_without_requirements,
      self.skipped_existing,
      self.failed,
    )
  }
}
