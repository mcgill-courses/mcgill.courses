use super::*;

#[derive(Clone, Debug)]
pub(crate) struct MongodbSessionStore {
  collection: Collection<Document>,
}

impl MongodbSessionStore {
  pub(crate) async fn new(
    uri: &str,
    db_name: &str,
    collection_name: &str,
  ) -> Result<Self> {
    let collection = MongoClient::with_uri_str(uri)
      .await?
      .database(db_name)
      .collection(collection_name);

    let store = Self { collection };

    store.initialize().await?;

    Ok(store)
  }

  async fn initialize(&self) -> Result {
    self
      .collection
      .create_index(
        IndexModel::builder()
          .keys(doc! { "expireAt": 1 })
          .options(
            IndexOptions::builder()
              .name("session_expire_index_expireAt".to_string())
              .expire_after(Duration::ZERO)
              .build(),
          )
          .build(),
      )
      .await?;

    Ok(())
  }
}

#[async_trait]
impl SessionStore for MongodbSessionStore {
  async fn load_session(
    &self,
    cookie_value: String,
  ) -> SessionResult<Option<Session>> {
    let id = Session::id_from_cookie_value(&cookie_value)?;

    let Some(document) =
      self.collection.find_one(doc! { "session_id": id }).await?
    else {
      return Ok(None);
    };

    if document
      .get("expireAt")
      .and_then(Bson::as_datetime)
      .is_some_and(|expiry| {
        expiry.timestamp_millis() < MongoDateTime::now().timestamp_millis()
      })
    {
      return Ok(None);
    }

    document
      .get("session")
      .cloned()
      .map(bson::deserialize_from_bson)
      .transpose()
      .map_err(Into::into)
  }

  async fn store_session(
    &self,
    session: Session,
  ) -> SessionResult<Option<String>> {
    let id = session.id();

    let expiry = session
      .expiry()
      .map(|expiry| MongoDateTime::from_millis(expiry.timestamp_millis()))
      .unwrap_or_else(|| {
        MongoDateTime::from_millis(
          MongoDateTime::now().timestamp_millis() + 1_200_000,
        )
      });

    let replacement = doc! {
      "session_id": id,
      "session": bson::serialize_to_bson(&session)?,
      "expireAt": expiry,
      "created": MongoDateTime::now(),
    };

    self
      .collection
      .replace_one(doc! { "session_id": id }, replacement)
      .upsert(true)
      .await?;

    Ok(session.into_cookie_value())
  }

  async fn destroy_session(&self, session: Session) -> SessionResult {
    self
      .collection
      .delete_one(doc! { "session_id": session.id() })
      .await?;

    Ok(())
  }

  async fn clear_store(&self) -> SessionResult {
    self.collection.drop().await?;

    self
      .initialize()
      .await
      .map_err(|error| anyhow!(error.to_string()))?;

    Ok(())
  }
}
