use super::*;

#[derive(Debug)]
pub(crate) struct Assets<'a> {
  pub(crate) ads: ServeFile,
  pub(crate) dir: ServeDir,
  pub(crate) index: ServeFile,
  pub(crate) route: &'a str,
}
