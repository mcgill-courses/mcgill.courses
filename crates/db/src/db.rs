use super::*;

#[derive(Debug, Clone)]
pub struct Db {
  database: Database,
}

impl Db {
  const COURSE_COLLECTION: &str = "courses";
  const REVIEW_COLLECTION: &str = "reviews";

  pub async fn connect(db_name: &str) -> Result<Self> {
    let mut client_options =
      ClientOptions::parse(format!("mongodb://localhost:27017/{}", db_name))
        .await?;

    client_options.app_name = Some(db_name.to_string());

    let client = Client::with_options(client_options)?;

    client
      .database(db_name)
      .run_command(doc! {"ping": 1}, None)
      .await?;

    info!("Connected to MongoDB.");

    Ok(Self {
      database: client.database(db_name),
    })
  }

  pub async fn seed(&self, source: PathBuf) -> Result {
    info!("Seeding courses...");

    for course in
      serde_json::from_str::<Vec<Course>>(&fs::read_to_string(&source)?)?
    {
      match self.find_course(doc! { "_id": &course.id, }).await? {
        Some(found) => {
          self
            .update_course(
              doc! { "_id": &course.id },
              doc! {
                "$set": {
                  "corequisites": course.corequisites,
                  "credits": course.credits,
                  "description": course.description,
                  "facultyUrl": course.faculty_url,
                  "instructors": course.instructors.combine(found.instructors),
                  "prerequisites": course.prerequisites,
                  "restrictions": course.restrictions,
                  "schedule": course.schedule.combine(found.schedule),
                  "terms": course.terms.combine(found.terms),
                  "url": course.url
                }
              },
            )
            .await?;
        }
        None => {
          self.add_course(course).await?;
        }
      }
    }

    info!("Finished seeding courses, building index...");

    self
      .create_course_index(
        doc! {
          "subject": "text",
          "code": "text",
          "_id": "text",
          "title": "text",
          "description": "text"
        },
        doc! {
          "subject": 4,
          "code": 4,
          "_id": 3,
          "title": 2,
          "description": 1
        },
      )
      .await?;

    info!("Course index complete.");

    Ok(())
  }

  pub async fn courses(
    &self,
    limit: Option<i64>,
    offset: Option<u64>,
  ) -> Result<Vec<Course>> {
    Ok(
      self
        .database
        .collection::<Course>(Db::COURSE_COLLECTION)
        .find(
          None,
          FindOptions::builder().skip(offset).limit(limit).build(),
        )
        .await?
        .try_collect::<Vec<Course>>()
        .await?,
    )
  }

  pub async fn search(&self, query: &str) -> Result<Vec<Course>> {
    info!("Received query: {query}");

    Ok(
      self
        .database
        .collection::<Course>(Db::COURSE_COLLECTION)
        .find(
          doc! { "$text" : { "$search": query } },
          FindOptions::builder()
            .sort(doc! { "score": { "$meta" : "textScore" }})
            .limit(10)
            .build(),
        )
        .await?
        .try_collect::<Vec<Course>>()
        .await?,
    )
  }

  pub async fn find_course_by_id(&self, id: &str) -> Result<Option<Course>> {
    self.find_course(doc! { "_id": id }).await
  }

  pub async fn add_review(&self, review: Review) -> Result<InsertOneResult> {
    if self
      .find_review(&review.course_id, &review.user_id)
      .await?
      .is_some()
    {
      Err(anyhow!("Cannot review this course twice"))
    } else {
      Ok(
        self
          .database
          .collection::<Review>(Db::REVIEW_COLLECTION)
          .insert_one(review, None)
          .await?,
      )
    }
  }

  pub async fn update_review(&self, review: Review) -> Result<UpdateResult> {
    Ok(
      self
        .database
        .collection::<Review>(Db::REVIEW_COLLECTION)
        .update_one(
          doc! {
            "courseId": review.course_id,
            "userId": review.user_id
          },
          UpdateModifications::Document(doc! {
            "$set": {
              "content": &review.content,
              "instructor": &review.instructor,
              "rating": review.rating,
              "timestamp": review.timestamp.format("%Y-%m-%dT%H:%M:%S%.6fZ").to_string()
            },
          }),
          None,
        )
        .await?,
    )
  }

  pub async fn delete_review(
    &self,
    course_id: &str,
    user_id: &str,
  ) -> Result<DeleteResult> {
    Ok(
      self
        .database
        .collection::<Review>(Db::REVIEW_COLLECTION)
        .delete_one(
          doc! {
            "courseId": course_id,
            "userId": user_id
          },
          None,
        )
        .await?,
    )
  }

  pub async fn find_reviews_by_course_id(
    &self,
    course_id: &str,
  ) -> Result<Vec<Review>> {
    self.find_reviews(doc! { "courseId": course_id }).await
  }

  pub async fn find_reviews_by_user_id(
    &self,
    user_id: &str,
  ) -> Result<Vec<Review>> {
    self.find_reviews(doc! { "userId": user_id }).await
  }

  pub async fn find_review(
    &self,
    course_id: &str,
    user_id: &str,
  ) -> Result<Option<Review>> {
    Ok(
      self
        .database
        .collection::<Review>(Db::REVIEW_COLLECTION)
        .find_one(doc! { "courseId": course_id, "userId": user_id }, None)
        .await?,
    )
  }

  async fn find_reviews(&self, query: Document) -> Result<Vec<Review>> {
    Ok(
      self
        .database
        .collection::<Review>(Db::REVIEW_COLLECTION)
        .find(query, None)
        .await?
        .try_collect::<Vec<Review>>()
        .await?,
    )
  }

  async fn find_course(&self, query: Document) -> Result<Option<Course>> {
    Ok(
      self
        .database
        .collection::<Course>(Db::COURSE_COLLECTION)
        .find_one(query, None)
        .await?,
    )
  }

  async fn add_course(&self, course: Course) -> Result<InsertOneResult> {
    Ok(
      self
        .database
        .collection::<Course>(Db::COURSE_COLLECTION)
        .insert_one(course, None)
        .await?,
    )
  }

  async fn update_course(
    &self,
    query: Document,
    update: Document,
  ) -> Result<UpdateResult> {
    Ok(
      self
        .database
        .collection::<Course>(Db::COURSE_COLLECTION)
        .update_one(query, UpdateModifications::Document(update), None)
        .await?,
    )
  }

  async fn create_course_index(
    &self,
    keys: Document,
    weights: Document,
  ) -> Result<CreateIndexResult> {
    Ok(
      self
        .database
        .collection::<Course>(Db::COURSE_COLLECTION)
        .create_index(
          IndexModel::builder()
            .keys(keys)
            .options(IndexOptions::builder().weights(weights).build())
            .build(),
          None,
        )
        .await?,
    )
  }

  #[cfg(test)]
  async fn reviews(&self) -> Result<Vec<Review>> {
    Ok(
      self
        .database
        .collection::<Review>(Db::REVIEW_COLLECTION)
        .find(None, None)
        .await?
        .try_collect::<Vec<Review>>()
        .await?,
    )
  }
}

#[cfg(test)]
mod tests {
  use {super::*, pretty_assertions::assert_eq};

  static SEED_DIR: Dir<'_> = include_dir!("crates/db/seeds");

  fn get_content(name: &str) -> String {
    SEED_DIR
      .get_file(name)
      .unwrap()
      .contents_utf8()
      .unwrap()
      .to_string()
  }

  struct TestContext {
    db: Db,
    db_name: String,
  }

  impl TestContext {
    async fn new() -> Self {
      static TEST_DATABASE_NUMBER: AtomicUsize = AtomicUsize::new(0);

      let test_database_number =
        TEST_DATABASE_NUMBER.fetch_add(1, Ordering::Relaxed);

      let db_name = format!(
        "mcgill-gg-test-{}-{}",
        std::time::SystemTime::now()
          .duration_since(std::time::SystemTime::UNIX_EPOCH)
          .unwrap()
          .as_millis(),
        test_database_number,
      );

      let db = Db::connect(&db_name).await.unwrap();

      TestContext { db, db_name }
    }
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn on_disk_database_is_persistent() {
    let TestContext { db, db_name } = TestContext::new().await;

    assert_eq!(db.courses(None, None).await.unwrap().len(), 0);

    db.add_course(Course::default()).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 1);

    drop(db);

    let db = Db::connect(&db_name).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn course_seeding_is_accurate() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("before_update.json")).unwrap();

    db.seed(source).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 2);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn course_seeding_does_not_insert_duplicates() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(
      &source,
      serde_json::to_string(
        &(0..10).map(|_| Course::default()).collect::<Vec<Course>>(),
      )
      .unwrap(),
    )
    .unwrap();

    db.seed(source).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn courses_get_updated_when_seeding() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("before_update.json")).unwrap();

    db.seed(source.clone()).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 2);

    fs::write(&source, get_content("update.json")).unwrap();

    db.seed(source).await.unwrap();

    let courses = db.courses(None, None).await.unwrap();

    assert_eq!(courses.len(), 3);

    assert_eq!(
      courses,
      serde_json::from_str::<Vec<Course>>(&get_content("after_update.json"))
        .unwrap()
    );
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn search_is_accurate() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.seed(source.clone()).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 83);

    let courses = db.search("COMP 202").await.unwrap();

    assert_eq!(courses.len(), 10);

    let first = courses.first().unwrap();

    assert_eq!(first.subject, "COMP");
    assert_eq!(first.code, "202");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn get_course_by_id() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.seed(source.clone()).await.unwrap();

    let courses = db.courses(None, None).await.unwrap();

    assert_eq!(courses.len(), 83);

    let first = courses.first().unwrap();

    assert_eq!(
      db.find_course_by_id(&first.id).await.unwrap().unwrap(),
      *first
    );
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn search_course_by_id_exact() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.seed(source.clone()).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 83);

    let courses = db.search("COMP202").await.unwrap();

    assert_eq!(courses.len(), 1);

    let first = courses.first().unwrap();

    assert_eq!(first.subject, "COMP");
    assert_eq!(first.code, "202");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn fuzzy_search_course_by_title() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.seed(source.clone()).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 83);

    let courses = db.search("foundations of").await.unwrap();

    assert_eq!(courses.len(), 5);

    let first = courses.first().unwrap();

    assert_eq!(first.subject, "COMP");
    assert_eq!(first.code, "202");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn fuzzy_search_course_by_description() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();
    db.seed(source.clone()).await.unwrap();

    assert_eq!(db.courses(None, None).await.unwrap().len(), 83);

    let courses = db.search("computing systems").await.unwrap();

    assert_eq!(courses.len(), 10);

    let first = courses.first().unwrap();

    assert_eq!(first.subject, "COMP");
    assert_eq!(first.code, "350");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn get_courses_with_limit() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.seed(source.clone()).await.unwrap();

    assert_eq!(db.courses(Some(10), None).await.unwrap().len(), 10);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn get_courses_with_offset() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.seed(source.clone()).await.unwrap();

    assert_eq!(db.courses(None, Some(20)).await.unwrap().len(), 63);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn add_reviews() {
    let TestContext { db, .. } = TestContext::new().await;

    let reviews = vec![
      Review {
        content: "foo".into(),
        course_id: "MATH240".into(),
        instructor: "test".into(),
        rating: 5,
        user_id: "1".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        course_id: "MATH240".into(),
        instructor: "test".into(),
        rating: 5,
        user_id: "2".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        course_id: "MATH240".into(),
        instructor: "test".into(),
        rating: 5,
        user_id: "3".into(),
        ..Default::default()
      },
    ];

    for review in &reviews {
      db.add_review(review.clone()).await.unwrap();
    }

    assert_eq!(db.reviews().await.unwrap().len(), 3);
    assert_eq!(db.reviews().await.unwrap(), reviews);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn find_reviews_by_course_id() {
    let TestContext { db, .. } = TestContext::new().await;

    let reviews = vec![
      Review {
        content: "foo".into(),
        user_id: "1".into(),
        instructor: "test".into(),
        rating: 5,
        course_id: "MATH240".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        user_id: "2".into(),
        instructor: "test".into(),
        rating: 5,
        course_id: "MATH240".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        user_id: "3".into(),
        instructor: "test".into(),
        rating: 5,
        course_id: "MATH340".into(),
        ..Default::default()
      },
    ];

    for review in &reviews {
      db.add_review(review.clone()).await.unwrap();
    }

    assert_eq!(db.reviews().await.unwrap().len(), 3);
    assert_eq!(db.reviews().await.unwrap(), reviews);

    assert_eq!(
      db.find_reviews_by_course_id("MATH240").await.unwrap(),
      vec![
        Review {
          content: "foo".into(),
          user_id: "1".into(),
          instructor: "test".into(),
          rating: 5,
          course_id: "MATH240".into(),
          ..Default::default()
        },
        Review {
          content: "foo".into(),
          course_id: "MATH240".into(),
          instructor: "test".into(),
          rating: 5,
          user_id: "2".into(),
          ..Default::default()
        }
      ]
    )
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn find_reviews_by_user_id() {
    let TestContext { db, .. } = TestContext::new().await;

    let reviews = vec![
      Review {
        content: "foo".into(),
        user_id: "1".into(),
        course_id: "MATH240".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        user_id: "2".into(),
        course_id: "MATH240".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        user_id: "3".into(),
        course_id: "MATH340".into(),
        ..Default::default()
      },
    ];

    for review in &reviews {
      db.add_review(review.clone()).await.unwrap();
    }

    assert_eq!(db.reviews().await.unwrap().len(), 3);
    assert_eq!(db.reviews().await.unwrap(), reviews);

    assert_eq!(
      db.find_reviews_by_user_id("2").await.unwrap(),
      vec![Review {
        content: "foo".into(),
        user_id: "2".into(),
        instructor: "".into(),
        rating: 0,
        course_id: "MATH240".into(),
        ..Default::default()
      },]
    )
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn dont_add_multiple_reviews_per_user() {
    let TestContext { db, .. } = TestContext::new().await;

    let review = Review {
      user_id: "1".into(),
      course_id: "MATH240".into(),
      ..Default::default()
    };

    db.add_review(review.clone()).await.unwrap();

    assert!(db.add_review(review).await.is_err());
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn update_review() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_review(Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      instructor: "bar".into(),
      rating: 5,
      user_id: "1".into(),
      timestamp: Utc::now(),
    })
    .await
    .unwrap();

    let timestamp = Utc::now();

    assert_eq!(
      db.update_review(Review {
        content: "bar".into(),
        course_id: "MATH240".into(),
        instructor: "foo".into(),
        rating: 4,
        user_id: "1".into(),
        timestamp
      })
      .await
      .unwrap()
      .modified_count,
      1
    );

    assert_eq!(
      db.update_review(Review {
        content: "bar".into(),
        course_id: "MATH240".into(),
        instructor: "foo".into(),
        rating: 4,
        user_id: "2".into(),
        ..Default::default()
      })
      .await
      .unwrap()
      .modified_count,
      0
    );

    let review = db.find_review("MATH240", "1").await.unwrap().unwrap();

    assert_eq!(review.content, "bar");
    assert_eq!(review.instructor, "foo");
    assert_eq!(review.rating, 4);
    assert_eq!(review.timestamp, timestamp);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn delete_review() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_review(Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      user_id: "1".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(
      db.delete_review("MATH240", "2")
        .await
        .unwrap()
        .deleted_count,
      0
    );

    assert_eq!(
      db.delete_review("MATH240", "1")
        .await
        .unwrap()
        .deleted_count,
      1
    );

    assert_eq!(db.find_review("MATH240", "1").await.unwrap(), None);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn delete_review_then_add_again() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_review(Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      user_id: "1".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(
      db.delete_review("MATH240", "1")
        .await
        .unwrap()
        .deleted_count,
      1
    );

    assert!(db
      .add_review(Review {
        content: "foo".into(),
        course_id: "MATH240".into(),
        user_id: "1".into(),
        ..Default::default()
      })
      .await
      .is_ok());
  }
}
