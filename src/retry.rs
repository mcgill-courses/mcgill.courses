use super::*;

pub(crate) trait Retry {
  fn retry(self, retries: usize) -> Result<reqwest::blocking::Response>;
}

impl Retry for RequestBuilder {
  fn retry(self, retries: usize) -> Result<reqwest::blocking::Response> {
    let mut attempts = 0;

    while attempts <= retries {
      match self
        .try_clone()
        .ok_or_else(|| anyhow!("Failed to clone request builder"))?
        .send()
      {
        Ok(response) => return Ok(response),
        Err(error) => {
          error!("Request failed: {error}");
          attempts += 1;
          thread::sleep(Duration::from_secs(1));
        }
      }
    }

    Err(Error(anyhow!("Request timed out")))
  }
}
