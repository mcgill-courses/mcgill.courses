use super::*;

#[async_trait]
pub(crate) trait Object {
  async fn get(&self, bucket: &str, key: &str) -> Result<Option<Vec<u8>>>;
  async fn put(&self, bucket: &str, key: &str, value: Vec<u8>) -> Result;
}

#[async_trait]
impl Object for S3Client {
  async fn get(&self, bucket: &str, key: &str) -> Result<Option<Vec<u8>>> {
    let response = self.get_object().bucket(bucket).key(key).send().await;

    Ok(match response {
      Ok(response) => {
        Some(response.body.collect().await?.into_bytes().to_vec())
      }
      Err(_) => None,
    })
  }

  async fn put(&self, bucket: &str, key: &str, value: Vec<u8>) -> Result {
    self
      .put_object()
      .bucket(bucket)
      .key(key)
      .body(ByteStream::from(value))
      .send()
      .await?;

    Ok(())
  }
}
