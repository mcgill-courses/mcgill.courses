use super::*;

#[derive(Debug, Clone)]
pub struct Db {
  client: Client,
  database: Database,
}

impl Db {
  const COURSE_COLLECTION: &'static str = "courses";
  const INSTRUCTOR_COLLECTION: &'static str = "instructors";
  const INTERACTION_COLLECTION: &'static str = "interactions";
  const NOTIFICATION_COLLECTION: &'static str = "notifications";
  const REVIEW_COLLECTION: &'static str = "reviews";
  const SUBSCRIPTION_COLLECTION: &'static str = "subscriptions";

  #[tracing::instrument(name = "db_connect", skip_all, fields(db_name = %db_name))]
  pub async fn connect(db_name: &str) -> Result<Self> {
    let mut client_options =
      ClientOptions::parse(env::var("MONGODB_URL").unwrap_or_else(|_| {
        format!("mongodb://localhost:27017/{db_name}?directConnection=true&replicaSet=rs0")
      }))
      .await?;

    client_options.app_name = Some(db_name.to_string());

    let client = Client::with_options(client_options)?;

    client
      .database(db_name)
      .run_command(doc! { "ping": 1 })
      .await?;

    info!("Connected to MongoDB");

    Ok(Self {
      database: client.database(db_name),
      client,
    })
  }

  pub fn name(&self) -> String {
    self.database.name().to_string()
  }

  pub async fn initialize(&self, options: InitializeOptions) -> Result {
    Initializer::new(self.clone(), options).run().await
  }

  pub async fn courses(
    &self,
    limit: Option<i64>,
    offset: Option<u64>,
    filter: Option<CourseFilter>,
  ) -> Result<Vec<Course>> {
    let (mut document, mut sort_document) = (Document::new(), Document::new());

    if let Some(filter) = filter {
      let CourseFilter {
        subjects,
        levels,
        terms,
        query,
        ..
      } = filter;

      if let Some(subjects) = subjects {
        document.insert(
          "subject",
          doc! { "$regex": format!("^({})", subjects.join("|")), "$options": "i" },
        );
      }

      if let Some(levels) = levels {
        document.insert(
          "code",
          doc! { "$regex": format!("^({})", levels.join("|")), "$options": "i" },
        );
      }

      if let Some(terms) = terms {
        document.insert(
          "terms",
          doc! { "$regex": format!("^({})", terms.join("|")), "$options": "i" },
        );
      }

      if let Some(query) = query.clone() {
        let current_terms = current_terms();

        let id = doc! {
          "_id": doc! {
            "$regex": format!(".*{}.*", query.replace(' ', "")),
            "$options": "i"
          }
        };

        let instructor = doc! {
          "instructors": doc! {
            "$elemMatch": doc! {
              "name": doc! {
                "$regex": format!(".*{}.*", query),
                "$options": "i"
              },
              "term": doc! {
                "$regex": format!(".*({}).*", current_terms.join("|")),
                "$options": "i"
              }
            }
          }
        };

        let rest = ["code", "description", "subject", "title"]
          .into_iter()
          .map(|field| {
            doc! { field: doc! {
              "$regex": format!(".*{}.*", query), "$options": "i" }
            }
          })
          .collect::<Vec<Document>>();

        document.insert("$or", [vec![id, instructor], rest].concat());
      }

      if let Some(sort_by) = filter.sort_by {
        let reverse = if sort_by.reverse { -1 } else { 1 };
        let field = match sort_by.sort_type {
          CourseSortType::Rating => {
            document.insert("reviewCount", doc! { "$gt": 0 });
            "avgRating"
          }
          CourseSortType::Difficulty => {
            document.insert("reviewCount", doc! { "$gt": 0 });
            "avgDifficulty"
          }
          CourseSortType::ReviewCount => "reviewCount",
        };
        sort_document.insert(field, reverse);
      } else if query.is_none() {
        sort_document.insert("_id", 1);
      }
    }

    let filter = if document.is_empty() {
      doc! {}
    } else {
      document
    };

    let collection =
      self.database.collection::<Course>(Self::COURSE_COLLECTION);

    let mut find = collection.find(filter);

    if !sort_document.is_empty() {
      find = find.sort(sort_document);
    }
    if let Some(offset) = offset {
      find = find.skip(offset);
    }
    if let Some(limit) = limit {
      find = find.limit(limit);
    }

    Ok(find.await?.try_collect::<Vec<Course>>().await?)
  }

  pub async fn course_count(&self) -> Result<u64> {
    Ok(
      self
        .database
        .collection::<Course>(Self::COURSE_COLLECTION)
        .count_documents(doc! {})
        .await?,
    )
  }

  #[tracing::instrument(name = "db_search", skip(self), fields(query = %query))]
  pub async fn search(&self, query: &str) -> Result<SearchResults> {
    Ok(SearchResults {
      courses: self
        .text_search::<Course>(Self::COURSE_COLLECTION, query, 4)
        .await?
        .try_collect()
        .await?,
      instructors: self
        .text_search::<Instructor>(Self::INSTRUCTOR_COLLECTION, query, 2)
        .await?
        .try_collect()
        .await?,
    })
  }

  #[tracing::instrument(name = "db_find_course_by_id", skip(self), fields(course_id = %id))]
  pub async fn find_course_by_id(&self, id: &str) -> Result<Option<Course>> {
    self.find_course(doc! { "_id": id }).await
  }

  #[tracing::instrument(name = "db_add_review", skip(self), fields(course_id = %review.course_id, user_id = %review.user_id))]
  pub async fn add_review(&self, review: Review) -> Result<UpdateResult> {
    let mut session = self.client.start_session().await?;
    session.start_transaction().await?;

    let course_coll =
      self.database.collection::<Course>(Self::COURSE_COLLECTION);

    let review_coll =
      self.database.collection::<Review>(Self::REVIEW_COLLECTION);

    let res = review_coll
      .update_one(
        doc! {
          "courseId": &review.course_id,
          "userId": &review.user_id
        },
        doc! {
          "$set": {
            "content": &review.content,
            "difficulty": review.difficulty,
            "instructors": &review.instructors,
            "rating": review.rating,
            "timestamp": review.timestamp,
            "likes": 0
          },
        },
      )
      .upsert(true)
      .session(&mut session)
      .await?;

    let course = course_coll
      .find_one(doc! {
        "_id": &review.course_id,
      })
      .session(&mut session)
      .await?
      .ok_or(Error::CourseNotFound)?;

    let count = course.review_count as f32;

    let avg_rating =
      (course.avg_rating * count + (review.rating as f32)) / (count + 1.0);

    let avg_difficulty = (course.avg_difficulty * count
      + (review.difficulty as f32))
      / (count + 1.0);

    course_coll
      .update_one(
        doc! {
          "_id": &review.course_id
        },
        doc! {
          "$inc": { "reviewCount": 1 },
          "$set": {
            "avgRating": avg_rating,
            "avgDifficulty": avg_difficulty,
          }
        },
      )
      .session(&mut session)
      .await?;

    session.commit_transaction().await?;

    Ok(res)
  }

  pub async fn delete_review(
    &self,
    course_id: &str,
    user_id: &str,
  ) -> Result<Review> {
    let mut session = self.client.start_session().await?;
    session.start_transaction().await?;

    let course_coll =
      self.database.collection::<Course>(Self::COURSE_COLLECTION);

    let review_coll =
      self.database.collection::<Review>(Self::REVIEW_COLLECTION);

    let review = review_coll
      .find_one_and_delete(doc! {
        "courseId": course_id,
        "userId": user_id
      })
      .session(&mut session)
      .await?
      .ok_or(Error::ReviewNotFound)?;

    let course = course_coll
      .find_one(doc! {
        "_id": course_id,
      })
      .session(&mut session)
      .await?
      .ok_or(Error::CourseNotFound)?;

    let (avg_rating, avg_difficulty) = if course.review_count == 0 {
      (0.0, 0.0)
    } else {
      let count = course.review_count as f32;

      let rating =
        (course.avg_rating * count - (review.rating as f32)) / (count - 1.0);

      let difficulty = (course.avg_difficulty * count
        - (review.difficulty as f32))
        / (count - 1.0);

      (rating, difficulty)
    };

    course_coll
      .update_one(
        doc! {
          "_id": &review.course_id
        },
        doc! {
          "$inc": { "reviewCount": -1 },
          "$set": {
            "avgRating": avg_rating,
            "avgDifficulty": avg_difficulty,
          }
        },
      )
      .session(&mut session)
      .await?;

    session.commit_transaction().await?;

    Ok(review)
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

  pub async fn find_reviews_by_instructor_name(
    &self,
    instructor_name: &str,
  ) -> Result<Vec<Review>> {
    self
      .find_reviews(doc! { "instructors": { "$in": vec![instructor_name] } })
      .await
  }

  pub async fn find_review(
    &self,
    course_id: &str,
    user_id: &str,
  ) -> Result<Option<Review>> {
    Ok(
      self
        .database
        .collection::<Review>(Self::REVIEW_COLLECTION)
        .find_one(doc! { "courseId": course_id, "userId": user_id })
        .await?,
    )
  }

  pub async fn add_interaction(&self, interaction: Interaction) -> Result {
    let mut session = self.client.start_session().await?;
    session.start_transaction().await?;

    let interaction_coll = self
      .database
      .collection::<Interaction>(Self::INTERACTION_COLLECTION);

    let review_coll =
      self.database.collection::<Review>(Self::REVIEW_COLLECTION);

    let old = interaction_coll
      .find_one_and_update(
        doc! {
          "courseId": &interaction.course_id,
          "userId": &interaction.user_id,
          "referrer": &interaction.referrer,
        },
        doc! {
          "$set": {
            "kind": Into::<Bson>::into(&interaction.kind)
          },
        },
      )
      .upsert(true)
      .session(&mut session)
      .await?;

    if let Some(ref old) = old
      && old.kind == interaction.kind
    {
      session.commit_transaction().await?;
      return Ok(());
    }

    let increment_amount = {
      let amt = match interaction.kind {
        InteractionKind::Like => 1,
        InteractionKind::Dislike => -1,
      };

      if old.is_some() { amt * 2 } else { amt }
    };

    review_coll
      .update_one(
        doc! {
          "courseId": interaction.course_id,
          "userId": interaction.user_id,
        },
        doc! {
          "$inc": {
            "likes": increment_amount
          }
        },
      )
      .session(&mut session)
      .await?;

    session.commit_transaction().await?;

    Ok(())
  }

  pub async fn delete_interaction(
    &self,
    course_id: &str,
    user_id: &str,
    referrer: &str,
  ) -> Result {
    let mut session = self.client.start_session().await?;
    session.start_transaction().await?;

    let interaction_coll = self
      .database
      .collection::<Interaction>(Self::INTERACTION_COLLECTION);

    let review_coll =
      self.database.collection::<Review>(Self::REVIEW_COLLECTION);

    let interaction = interaction_coll
      .find_one_and_delete(doc! {
        "courseId": course_id,
        "userId": user_id,
        "referrer": referrer,
      })
      .session(&mut session)
      .await?;

    if let Some(i) = interaction {
      review_coll
        .update_one(doc! {
          "courseId": course_id,
          "userId": user_id,
        }, doc! {
          "$inc": {
            "likes": match i.kind { InteractionKind::Like => -1, InteractionKind::Dislike => 1 }
          }
        })
        .session(&mut session)
        .await?;
    }

    session.commit_transaction().await?;

    Ok(())
  }

  pub async fn delete_interactions(
    &self,
    course_id: &str,
    user_id: &str,
  ) -> Result<DeleteResult> {
    Ok(
      self
        .database
        .collection::<Interaction>(Self::INTERACTION_COLLECTION)
        .delete_many(doc! {
          "courseId": course_id,
          "userId": user_id,
        })
        .await?,
    )
  }

  pub async fn interactions_for_review(
    &self,
    course_id: &str,
    user_id: &str,
  ) -> Result<Vec<Interaction>> {
    Ok(
      self
        .database
        .collection::<Interaction>(Self::INTERACTION_COLLECTION)
        .find(doc! { "courseId": course_id, "userId": user_id })
        .await?
        .try_collect::<Vec<Interaction>>()
        .await?,
    )
  }

  pub async fn interaction_kind(
    &self,
    course_id: &str,
    user_id: &str,
    referrer: &str,
  ) -> Result<Option<InteractionKind>> {
    Ok(
      self
        .database
        .collection::<Interaction>(Self::INTERACTION_COLLECTION)
        .find_one(doc! { "courseId": course_id, "userId": user_id, "referrer": referrer })
        .await?.map(|i| i.kind)
    )
  }

  pub async fn user_interactions_for_course(
    &self,
    course_id: &str,
    referrer: &str,
  ) -> Result<Vec<Interaction>> {
    Ok(
      self
        .database
        .collection::<Interaction>(Self::INTERACTION_COLLECTION)
        .find(doc! { "courseId": course_id, "referrer": referrer })
        .await?
        .try_collect::<Vec<Interaction>>()
        .await?,
    )
  }

  pub async fn liked_reviews_for_user(
    &self,
    referrer: &str,
  ) -> Result<Vec<Review>> {
    let interactions = self
      .database
      .collection::<Interaction>(Self::INTERACTION_COLLECTION)
      .find(doc! { "referrer": referrer, "kind": InteractionKind::Like })
      .await?
      .try_collect::<Vec<Interaction>>()
      .await?;

    if interactions.is_empty() {
      return Ok(vec![]);
    }

    let filters = interactions
      .iter()
      .map(|interaction| {
        doc! { "courseId": &interaction.course_id, "userId": &interaction.user_id }
      })
      .collect::<Vec<_>>();

    let collection =
      self.database.collection::<Review>(Self::REVIEW_COLLECTION);

    let mut find = collection.find(doc! { "$or": filters });

    find = find.sort(doc! { "timestamp": -1 });

    Ok(find.await?.try_collect::<Vec<Review>>().await?)
  }

  pub async fn get_subscription(
    &self,
    user_id: &str,
    course_id: &str,
  ) -> Result<Option<Subscription>> {
    Ok(
      self
        .database
        .collection::<Subscription>(Self::SUBSCRIPTION_COLLECTION)
        .find_one(doc! {
          "courseId": course_id,
          "userId": user_id,
        })
        .await?,
    )
  }

  pub async fn get_subscriptions(
    &self,
    user_id: &str,
  ) -> Result<Vec<Subscription>> {
    Ok(
      self
        .database
        .collection::<Subscription>(Self::SUBSCRIPTION_COLLECTION)
        .find(doc! {
          "userId": user_id,
        })
        .await?
        .try_collect::<Vec<Subscription>>()
        .await?,
    )
  }

  pub async fn add_subscription(
    &self,
    subscription: Subscription,
  ) -> Result<InsertOneResult> {
    Ok(
      self
        .database
        .collection::<Subscription>(Self::SUBSCRIPTION_COLLECTION)
        .insert_one(subscription)
        .await?,
    )
  }

  pub async fn delete_subscription(
    &self,
    subscription: Subscription,
  ) -> Result<DeleteResult> {
    Ok(
      self
        .database
        .collection::<Subscription>(Self::SUBSCRIPTION_COLLECTION)
        .delete_one(doc! {
          "courseId": subscription.course_id,
          "userId": subscription.user_id,
        })
        .await?,
    )
  }

  pub async fn get_notifications(
    &self,
    user_id: &str,
  ) -> Result<Vec<Notification>> {
    Ok(
      self
        .database
        .collection::<Notification>(Self::NOTIFICATION_COLLECTION)
        .find(doc! { "userId": user_id })
        .await?
        .try_collect::<Vec<Notification>>()
        .await?,
    )
  }

  pub async fn add_notifications(&self, review: Review) -> Result {
    let course_id = review.course_id.clone();

    let subscriptions = self
      .database
      .collection::<Subscription>(Self::SUBSCRIPTION_COLLECTION)
      .find(doc! { "courseId": course_id })
      .await?
      .try_collect::<Vec<Subscription>>()
      .await?;

    let subscriptions = subscriptions
      .into_iter()
      .filter(|subscription| subscription.user_id != review.user_id)
      .collect::<Vec<Subscription>>();

    if subscriptions.is_empty() {
      return Ok(());
    }

    self
      .database
      .collection::<Notification>(Self::NOTIFICATION_COLLECTION)
      .insert_many(
        subscriptions
          .into_iter()
          .map(|subscription| Notification {
            review: review.clone(),
            seen: false,
            user_id: subscription.user_id,
          })
          .collect::<Vec<Notification>>(),
      )
      .await?;

    Ok(())
  }

  pub async fn delete_notification(
    &self,
    user_id: &str,
    course_id: &str,
    review_user_id: &str,
  ) -> Result<DeleteResult> {
    Ok(
      self
        .database
        .collection::<Notification>(Self::NOTIFICATION_COLLECTION)
        .delete_one(doc! {
          "userId": user_id,
          "review.courseId": course_id,
          "review.userId": review_user_id,
        })
        .await?,
    )
  }

  pub async fn delete_notifications(
    &self,
    creator_id: &str,
    course_id: &str,
  ) -> Result<DeleteResult> {
    Ok(
      self
        .database
        .collection::<Notification>(Self::NOTIFICATION_COLLECTION)
        .delete_many(doc! {
          "review.userId": creator_id,
          "review.courseId": course_id
        })
        .await?,
    )
  }

  pub async fn purge_notifications(
    &self,
    user_id: &str,
    course_id: &str,
  ) -> Result<DeleteResult> {
    Ok(
      self
        .database
        .collection::<Notification>(Self::NOTIFICATION_COLLECTION)
        .delete_many(doc! {
          "userId": user_id,
          "review.courseId": course_id
        })
        .await?,
    )
  }

  pub async fn update_notifications(
    &self,
    creator_id: &str,
    course_id: &str,
    review: Review,
  ) -> Result<UpdateResult> {
    Ok(
      self
        .database
        .collection::<Notification>(Self::NOTIFICATION_COLLECTION)
        .update_many(
          doc! {
            "review.userId": creator_id,
            "review.courseId": course_id
          },
          doc! {
            "$set": {
              "review": Into::<Bson>::into(review),
              "seen": false
            }
          },
        )
        .await?,
    )
  }

  pub async fn update_notification(
    &self,
    user_id: &str,
    course_id: &str,
    creator_id: &str,
    seen: bool,
  ) -> Result<UpdateResult> {
    Ok(
      self
        .database
        .collection::<Notification>(Self::NOTIFICATION_COLLECTION)
        .update_one(
          doc! {
            "userId": user_id,
            "review.courseId": course_id,
            "review.userId": creator_id
          },
          doc! {
            "$set": {
              "seen": seen
            }
          },
        )
        .await?,
    )
  }

  async fn find_reviews(&self, query: Document) -> Result<Vec<Review>> {
    Ok(
      self
        .database
        .collection::<Review>(Self::REVIEW_COLLECTION)
        .find(query)
        .await?
        .try_collect::<Vec<Review>>()
        .await?,
    )
  }

  async fn find_course(&self, query: Document) -> Result<Option<Course>> {
    Ok(
      self
        .database
        .collection::<Course>(Self::COURSE_COLLECTION)
        .find_one(query)
        .await?,
    )
  }

  pub async fn find_courses_by_instructor_name(
    &self,
    name: &str,
  ) -> Result<Vec<Course>> {
    Ok(
      self
        .database
        .collection::<Course>(Self::COURSE_COLLECTION)
        .find(doc! { "instructors.name": name })
        .await?
        .try_collect::<Vec<Course>>()
        .await?,
    )
  }
  pub(crate) async fn add_course(&self, course: Course) -> Result {
    match self.find_course(doc! { "_id": &course.id }).await? {
      Some(found) => {
        self
          .update_course(
            doc! { "_id": &course.id },
            doc! {
              "$set": {
                "code": course.code,
                "corequisites": course.corequisites,
                "corequisitesText": course.corequisites_text,
                "credits": course.credits,
                "department": course.department,
                "description": course.description,
                "faculty": course.faculty,
                "instructors": course.instructors.combine(found.instructors),
                "leadingTo": course.leading_to,
                "logicalCorequisites": course.logical_corequisites,
                "logicalPrerequisites": course.logical_prerequisites,
                "prerequisites": course.prerequisites,
                "prerequisitesText": course.prerequisites_text,
                "restrictions": course.restrictions,
                "schedule": course.schedule,
                "subject": course.subject,
                "terms": course.terms.combine(found.terms),
                "title": course.title.clone(),
                "titleNgrams": course.title.filter_stopwords().ngrams(),
                "url": course.url,
              }
            },
          )
          .await?;
      }
      None => {
        self
          .database
          .collection::<Course>(Self::COURSE_COLLECTION)
          .insert_one(Course {
            id_ngrams: Some(course.id.ngrams()),
            title_ngrams: Some(course.title.filter_stopwords().ngrams()),
            ..course
          })
          .await?;
      }
    }

    Ok(())
  }

  async fn update_course(
    &self,
    query: Document,
    update: Document,
  ) -> Result<UpdateResult> {
    Ok(
      self
        .database
        .collection::<Course>(Self::COURSE_COLLECTION)
        .update_one(query, update)
        .await?,
    )
  }

  async fn text_search<T>(
    &self,
    collection: &str,
    query: &str,
    limit: i64,
  ) -> Result<Cursor<T>>
  where
    T: Serialize + DeserializeOwned + Send + Sync,
  {
    Ok(
      self
        .database
        .collection::<T>(collection)
        .find(doc! {
          "$text": {
            "$search": query
          }
        })
        .sort(doc! { "score": { "$meta" : "textScore" }})
        .limit(limit)
        .await?,
    )
  }

  pub(crate) async fn create_index<T>(
    &self,
    collection: &str,
    keys: Document,
    weights: Document,
  ) -> Result<CreateIndexResult>
  where
    T: Serialize + DeserializeOwned + Send + Sync,
  {
    Ok(
      self
        .database
        .collection::<T>(collection)
        .create_index(
          IndexModel::builder()
            .keys(keys)
            .options(IndexOptions::builder().weights(weights).build())
            .build(),
        )
        .await?,
    )
  }

  pub(crate) async fn add_instructor(&self, instructor: Instructor) -> Result {
    if self
      .find_instructor_by_name(&instructor.name)
      .await?
      .is_none()
    {
      self
        .database
        .collection::<Instructor>(Self::INSTRUCTOR_COLLECTION)
        .insert_one(Instructor {
          name_ngrams: Some(instructor.name.ngrams()),
          ..instructor
        })
        .await?;
    };

    Ok(())
  }

  async fn find_instructor(
    &self,
    query: Document,
  ) -> Result<Option<Instructor>> {
    Ok(
      self
        .database
        .collection::<Instructor>(Self::INSTRUCTOR_COLLECTION)
        .find_one(query)
        .await?,
    )
  }

  pub async fn find_instructor_by_name(
    &self,
    name: &str,
  ) -> Result<Option<Instructor>> {
    self.find_instructor(doc! { "name": name }).await
  }

  pub async fn reviews(
    &self,
    limit: Option<i64>,
    offset: Option<u64>,
    filter: Option<ReviewFilter>,
  ) -> Result<Vec<Review>> {
    let (mut document, mut sort_document) = (Document::new(), Document::new());

    if let Some(filter) = filter {
      let ReviewFilter {
        course_id,
        instructor_name,
        sorted,
        user_id,
      } = filter;

      if let Some(course_id) = course_id {
        document.insert("courseId", course_id);
      }

      if let Some(user_id) = user_id {
        document.insert("userId", user_id);
      }

      if let Some(instructor_name) = instructor_name {
        document.insert(
          "instructors",
          doc! { "instructors": { "$in": vec![instructor_name] } },
        );
      }

      if sorted.unwrap_or(false) {
        sort_document.insert("timestamp", -1);
      }
    }

    let filter = if document.is_empty() {
      doc! {}
    } else {
      document
    };

    let collection =
      self.database.collection::<Review>(Self::REVIEW_COLLECTION);

    let mut find = collection.find(filter);

    if !sort_document.is_empty() {
      find = find.sort(sort_document);
    }
    if let Some(offset) = offset {
      find = find.skip(offset);
    }
    if let Some(limit) = limit {
      find = find.limit(limit);
    }

    Ok(find.await?.try_collect::<Vec<Review>>().await?)
  }

  pub async fn unique_user_count(&self) -> Result<u64> {
    // Timestamp of https://github.com/terror/mcgill.courses/pull/500
    let rmp_scrape_epoch: chrono::DateTime<Utc> =
      Utc.timestamp_opt(1713472800, 0).unwrap();

    let reviews = self
      .database
      .collection::<Review>(Self::REVIEW_COLLECTION)
      .distinct(
        "userId",
        doc! {
          "timestamp": { "$gte": rmp_scrape_epoch }
        },
      )
      .await?;

    Ok(reviews.len().try_into()?)
  }

  #[cfg(test)]
  async fn instructors(&self) -> Result<Vec<Instructor>> {
    Ok(
      self
        .database
        .collection::<Instructor>(Self::INSTRUCTOR_COLLECTION)
        .find(doc! {})
        .await?
        .try_collect::<Vec<Instructor>>()
        .await?,
    )
  }

  #[cfg(test)]
  async fn subscriptions(&self) -> Result<Vec<Subscription>> {
    Ok(
      self
        .database
        .collection::<Subscription>(Self::SUBSCRIPTION_COLLECTION)
        .find(doc! {})
        .await?
        .try_collect::<Vec<Subscription>>()
        .await?,
    )
  }

  #[cfg(test)]
  async fn notifications(&self) -> Result<Vec<Notification>> {
    Ok(
      self
        .database
        .collection::<Notification>(Self::NOTIFICATION_COLLECTION)
        .find(doc! {})
        .await?
        .try_collect::<Vec<Notification>>()
        .await?,
    )
  }
}

#[cfg(test)]
mod tests {
  use {super::*, pretty_assertions::assert_eq, regex::Regex};

  static SEED_DIR: Dir<'_> = include_dir!("crates/db/test-seeds");

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
        "mcgill-courses-test-{}-{}",
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

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 0);

    db.add_course(Course::default()).await.unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 1);

    drop(db);

    let db = Db::connect(&db_name).await.unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn course_seeding_is_accurate() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("before_update.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 2);
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

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn courses_get_updated_when_seeding() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("before_update.json")).unwrap();

    db.initialize(InitializeOptions {
      source: source.clone(),
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 2);

    fs::write(&source, get_content("update.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    let courses = db.courses(None, None, None).await.unwrap();

    assert_eq!(courses.len(), 3);

    assert_eq!(
      courses,
      serde_json::from_str::<Vec<Course>>(&get_content("after_update.json"))
        .unwrap()
        .into_iter()
        .map(|c| Course {
          id_ngrams: Some(c.id.ngrams()),
          title_ngrams: Some(c.title.filter_stopwords().ngrams()),
          ..c
        })
        .collect::<Vec<Course>>()
    );
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn search_is_accurate() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 123);

    let results = db.search("COMP 202").await.unwrap();

    assert_eq!(results.courses.len(), 4);

    let first = results.courses.first().unwrap();

    assert_eq!(first.subject, "COMP");
    assert_eq!(first.code, "202");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn get_course_by_id() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    let courses = db.courses(None, None, None).await.unwrap();

    assert_eq!(courses.len(), 123);

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

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 123);

    let results = db.search("COMP202").await.unwrap();

    assert_eq!(results.courses.len(), 1);

    let first = results.courses.first().unwrap();

    assert_eq!(first.subject, "COMP");
    assert_eq!(first.code, "202");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn fuzzy_search_course_by_title() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 123);

    let results = db.search("foundations of").await.unwrap();

    assert_eq!(results.courses.len(), 1);

    let first = results.courses.first().unwrap();

    assert_eq!(first.subject, "COMP");
    assert_eq!(first.code, "202");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn get_courses_with_limit() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.courses(Some(10), None, None).await.unwrap().len(), 10);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn get_courses_with_sort_filter() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "COMP252".into(),
      user_id: "1".into(),
      rating: 5,
      difficulty: 4,
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "COMP252".into(),
      user_id: "2".into(),
      rating: 4,
      difficulty: 3,
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "COMP362".into(),
      user_id: "1".into(),
      rating: 3,
      difficulty: 5,
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "COMP362".into(),
      user_id: "2".into(),
      rating: 4,
      difficulty: 4,
      ..Default::default()
    })
    .await
    .unwrap();

    let courses = db
      .courses(
        Some(10),
        None,
        Some(CourseFilter {
          sort_by: Some(CourseSort {
            sort_type: CourseSortType::Rating,
            reverse: true,
          }),
          ..Default::default()
        }),
      )
      .await
      .unwrap();

    assert!(
      db.find_course_by_id("COMP252")
        .await
        .unwrap()
        .unwrap()
        .avg_rating
        - 4.5
        < 0.01,
    );

    assert_eq!(courses[0].id, "COMP252");
    assert_eq!(courses[1].id, "COMP362");

    let courses = db
      .courses(
        Some(10),
        None,
        Some(CourseFilter {
          sort_by: Some(CourseSort {
            sort_type: CourseSortType::Difficulty,
            reverse: true,
          }),
          ..Default::default()
        }),
      )
      .await
      .unwrap();

    assert_eq!(courses[0].id, "COMP362");
    assert_eq!(courses[1].id, "COMP252");

    db.add_review(Review {
      course_id: "COMP400".into(),
      user_id: "1".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "COMP400".into(),
      user_id: "2".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      course_id: "COMP400".into(),
      user_id: "3".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    let courses = db
      .courses(
        Some(10),
        None,
        Some(CourseFilter {
          sort_by: Some(CourseSort {
            sort_type: CourseSortType::ReviewCount,
            reverse: true,
          }),
          ..Default::default()
        }),
      )
      .await
      .unwrap();

    assert_eq!(courses[0].id, "COMP400");
    assert_eq!(courses[0].review_count, 3);
    assert_eq!(courses[1].review_count, 2);
    assert_eq!(courses[2].review_count, 2);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn add_reviews() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    let reviews = vec![
      Review {
        content: "foo".into(),
        course_id: "MATH240".into(),
        instructors: vec![String::from("test")],
        rating: 5,
        difficulty: 2,
        user_id: "1".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        course_id: "MATH240".into(),
        instructors: vec![String::from("test")],
        rating: 4,
        difficulty: 3,
        user_id: "2".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        course_id: "MATH240".into(),
        instructors: vec![String::from("test")],
        rating: 3,
        difficulty: 2,
        user_id: "3".into(),
        ..Default::default()
      },
    ];

    for review in &reviews {
      db.add_review(review.clone()).await.unwrap();
    }

    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 3);
    assert_eq!(db.reviews(None, None, None).await.unwrap(), reviews);

    let course = db.find_course_by_id("MATH240").await.unwrap().unwrap();
    assert!(course.avg_rating - 4.0 < 0.001);
    assert!(course.avg_difficulty - 2.33 < 0.1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn find_reviews_by_course_id() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_course(Course {
      id: "MATH340".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    let reviews = vec![
      Review {
        content: "foo".into(),
        user_id: "1".into(),
        instructors: vec![String::from("test")],
        rating: 5,
        course_id: "MATH240".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        user_id: "2".into(),
        instructors: vec![String::from("test")],
        rating: 5,
        course_id: "MATH240".into(),
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        user_id: "3".into(),
        instructors: vec![String::from("test")],
        rating: 5,
        course_id: "MATH340".into(),
        ..Default::default()
      },
    ];

    for review in &reviews {
      db.add_review(review.clone()).await.unwrap();
    }

    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 3);
    assert_eq!(db.reviews(None, None, None).await.unwrap(), reviews);

    assert_eq!(
      db.find_reviews_by_course_id("MATH240").await.unwrap(),
      vec![
        Review {
          content: "foo".into(),
          user_id: "1".into(),
          instructors: vec![String::from("test")],
          rating: 5,
          course_id: "MATH240".into(),
          ..Default::default()
        },
        Review {
          content: "foo".into(),
          course_id: "MATH240".into(),
          instructors: vec![String::from("test")],
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

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_course(Course {
      id: "MATH340".into(),
      ..Default::default()
    })
    .await
    .unwrap();

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

    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 3);
    assert_eq!(db.reviews(None, None, None).await.unwrap(), reviews);

    assert_eq!(
      db.find_reviews_by_user_id("2").await.unwrap(),
      vec![Review {
        content: "foo".into(),
        user_id: "2".into(),
        course_id: "MATH240".into(),
        ..Default::default()
      },]
    )
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn find_reviews_by_user_instructor_name() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_course(Course {
      id: "MATH340".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    let reviews = vec![
      Review {
        content: "foo".into(),
        user_id: "1".into(),
        course_id: "MATH240".into(),
        instructors: vec![
          String::from("test"),
          String::from("foo"),
          String::from("bar"),
        ],
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        user_id: "2".into(),
        course_id: "MATH240".into(),
        instructors: vec![String::from("test"), String::from("foo")],
        ..Default::default()
      },
      Review {
        content: "foo".into(),
        user_id: "3".into(),
        course_id: "MATH340".into(),
        instructors: vec![String::from("foo"), String::from("bar")],
        ..Default::default()
      },
    ];

    for review in &reviews {
      db.add_review(review.clone()).await.unwrap();
    }

    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 3);
    assert_eq!(db.reviews(None, None, None).await.unwrap(), reviews);

    assert_eq!(
      db.find_reviews_by_instructor_name("test").await.unwrap(),
      vec![
        Review {
          content: "foo".into(),
          user_id: "1".into(),
          course_id: "MATH240".into(),
          instructors: vec![
            String::from("test"),
            String::from("foo"),
            String::from("bar"),
          ],
          ..Default::default()
        },
        Review {
          content: "foo".into(),
          user_id: "2".into(),
          course_id: "MATH240".into(),
          instructors: vec![String::from("test"), String::from("foo")],
          ..Default::default()
        },
      ]
    )
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn dont_add_multiple_reviews_per_user() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    let review = Review {
      user_id: "1".into(),
      course_id: "MATH240".into(),
      ..Default::default()
    };

    for _ in 0..10 {
      db.add_review(review.clone()).await.unwrap();
    }

    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn update_review() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      instructors: vec![String::from("bar")],
      rating: 5,
      difficulty: 5,
      user_id: "1".into(),
      timestamp: DateTime::from(Utc::now()),
      ..Review::default()
    })
    .await
    .unwrap();

    let timestamp = DateTime::from(Utc::now());

    assert_eq!(
      db.add_review(Review {
        content: "bar".into(),
        course_id: "MATH240".into(),
        instructors: vec![String::from("foo")],
        rating: 4,
        difficulty: 4,
        user_id: "1".into(),
        timestamp: timestamp.clone(),
        ..Review::default()
      })
      .await
      .unwrap()
      .modified_count,
      1
    );

    assert_eq!(
      db.add_review(Review {
        content: "bar".into(),
        course_id: "MATH240".into(),
        instructors: vec![String::from("foo")],
        rating: 4,
        difficulty: 4,
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
    assert_eq!(review.instructors, vec![String::from("foo")]);
    assert_eq!(review.rating, 4);
    assert_eq!(review.timestamp, timestamp);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn delete_review() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      user_id: "1".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    assert!(db.delete_review("MATH240", "2").await.is_err());

    assert!(db.delete_review("MATH240", "1").await.is_ok());

    assert_eq!(db.find_review("MATH240", "1").await.unwrap(), None);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn delete_review_then_add_again() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_review(Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      user_id: "1".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    assert!(db.delete_review("MATH240", "1").await.is_ok());

    assert!(
      db.add_review(Review {
        content: "foo".into(),
        course_id: "MATH240".into(),
        user_id: "1".into(),
        ..Default::default()
      })
      .await
      .is_ok()
    );
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn filter_courses_by_subject() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("mix.json")).unwrap();

    db.initialize(InitializeOptions {
      source,

      ..Default::default()
    })
    .await
    .unwrap();

    let total = db.courses(None, None, None).await.unwrap();

    assert_eq!(total.len(), 314);

    let filtered = db
      .courses(
        None,
        None,
        Some(CourseFilter {
          subjects: Some(vec!["MATH".into()]),
          ..Default::default()
        }),
      )
      .await
      .unwrap();

    assert!(filtered.len() < total.len());

    for course in filtered {
      assert_eq!(course.subject, "MATH");
    }
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn filter_courses_by_level() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("mix.json")).unwrap();

    db.initialize(InitializeOptions {
      source,

      ..Default::default()
    })
    .await
    .unwrap();

    let total = db.courses(None, None, None).await.unwrap();

    assert_eq!(total.len(), 314);

    let filtered = db
      .courses(
        None,
        None,
        Some(CourseFilter {
          levels: Some(vec!["100".into()]),
          ..Default::default()
        }),
      )
      .await
      .unwrap();

    assert!(filtered.len() < total.len());

    for course in filtered {
      assert!(course.code.starts_with('1'));
    }
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn filter_courses_by_term() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("mix.json")).unwrap();

    db.initialize(InitializeOptions {
      source,

      ..Default::default()
    })
    .await
    .unwrap();

    let total = db.courses(None, None, None).await.unwrap();

    assert_eq!(total.len(), 314);

    let filtered = db
      .courses(
        None,
        None,
        Some(CourseFilter {
          terms: Some(vec!["Winter".into()]),
          ..Default::default()
        }),
      )
      .await
      .unwrap();

    assert!(filtered.len() < total.len());

    for course in filtered {
      assert!(
        course
          .terms
          .iter()
          .any(|term| term.starts_with(&"Winter".to_string()))
      );
    }
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn add_instructors() {
    let TestContext { db, .. } = TestContext::new().await;

    let instructors = vec![
      Instructor {
        name: "foo".into(),
        term: "Summer 2023".into(),
        ..Default::default()
      },
      Instructor {
        name: "bar".into(),
        term: "Summer 2023".into(),
        ..Default::default()
      },
      Instructor {
        name: "bar".into(),
        term: "Winter 2023".into(),
        ..Default::default()
      },
    ];

    for instructor in instructors {
      db.add_instructor(instructor).await.unwrap();
    }

    assert_eq!(db.instructors().await.unwrap().len(), 2);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn search_instructor_by_name_exact() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("search.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.courses(None, None, None).await.unwrap().len(), 123);

    let results = db.search("Giulia Alberini").await.unwrap();

    assert_eq!(results.instructors.len(), 1);

    assert_eq!(results.instructors.first().unwrap().name, "Giulia Alberini");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn review_interaction_flow() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    let review = Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      user_id: "1".into(),
      ..Default::default()
    };

    db.add_review(review.clone()).await.unwrap();

    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 1);

    db.add_interaction(Interaction {
      kind: InteractionKind::Like,
      course_id: review.course_id.clone(),
      user_id: review.user_id.clone(),
      referrer: "10".into(),
    })
    .await
    .unwrap();

    let interactions = db
      .interactions_for_review(&review.course_id, &review.user_id)
      .await
      .unwrap();

    assert_eq!(interactions.len(), 1);
    assert_eq!(interactions.first().unwrap().kind, InteractionKind::Like);

    let review = db
      .find_review(&review.course_id, &review.user_id)
      .await
      .unwrap()
      .unwrap();
    assert_eq!(review.likes, 1);

    db.add_interaction(Interaction {
      kind: InteractionKind::Dislike,
      course_id: review.course_id.clone(),
      user_id: review.user_id.clone(),
      referrer: "10".into(),
    })
    .await
    .unwrap();

    let interactions = db
      .interactions_for_review(&review.course_id, &review.user_id)
      .await
      .unwrap();

    assert_eq!(interactions.len(), 1);
    assert_eq!(interactions.first().unwrap().kind, InteractionKind::Dislike);

    let review = db
      .find_review(&review.course_id, &review.user_id)
      .await
      .unwrap()
      .unwrap();
    assert_eq!(review.likes, -1);

    db.delete_interaction(&review.course_id, &review.user_id, "10")
      .await
      .unwrap();

    assert_eq!(
      db.interactions_for_review(&review.course_id, &review.user_id)
        .await
        .unwrap()
        .len(),
      0
    );

    let review = db
      .find_review(&review.course_id, &review.user_id)
      .await
      .unwrap()
      .unwrap();
    assert_eq!(review.likes, 0);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn liked_reviews_for_user() {
    let TestContext { db, .. } = TestContext::new().await;

    db.add_course(Course {
      id: "COMP202".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_course(Course {
      id: "PHYS101".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    let review_one = Review {
      content: "first".into(),
      course_id: "COMP202".into(),
      user_id: "author1".into(),
      timestamp: DateTime::from_millis(1000),
      ..Review::default()
    };

    let review_two = Review {
      content: "second".into(),
      course_id: "MATH240".into(),
      user_id: "author2".into(),
      timestamp: DateTime::from_millis(2000),
      ..Review::default()
    };

    let review_three = Review {
      content: "third".into(),
      course_id: "PHYS101".into(),
      user_id: "author3".into(),
      timestamp: DateTime::from_millis(3000),
      ..Review::default()
    };

    db.add_review(review_one.clone()).await.unwrap();
    db.add_review(review_two.clone()).await.unwrap();
    db.add_review(review_three.clone()).await.unwrap();

    db.add_interaction(Interaction {
      kind: InteractionKind::Like,
      course_id: review_one.course_id.clone(),
      user_id: review_one.user_id.clone(),
      referrer: "viewer".into(),
    })
    .await
    .unwrap();

    db.add_interaction(Interaction {
      kind: InteractionKind::Dislike,
      course_id: review_two.course_id.clone(),
      user_id: review_two.user_id.clone(),
      referrer: "viewer".into(),
    })
    .await
    .unwrap();

    db.add_interaction(Interaction {
      kind: InteractionKind::Like,
      course_id: review_two.course_id.clone(),
      user_id: review_two.user_id.clone(),
      referrer: "other".into(),
    })
    .await
    .unwrap();

    db.add_interaction(Interaction {
      kind: InteractionKind::Like,
      course_id: review_three.course_id.clone(),
      user_id: review_three.user_id.clone(),
      referrer: "viewer".into(),
    })
    .await
    .unwrap();

    let liked_reviews = db.liked_reviews_for_user("viewer").await.unwrap();

    assert_eq!(liked_reviews.len(), 2);
    assert_eq!(liked_reviews[0].course_id, "PHYS101");
    assert_eq!(liked_reviews[0].user_id, "author3");
    assert_eq!(liked_reviews[1].course_id, "COMP202");
    assert_eq!(liked_reviews[1].user_id, "author1");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn subscription_flow() {
    let TestContext { db, .. } = TestContext::new().await;

    let subscription = Subscription {
      course_id: "MATH240".into(),
      user_id: "1".into(),
    };

    db.add_subscription(subscription.clone()).await.unwrap();

    assert_eq!(db.subscriptions().await.unwrap().len(), 1);

    db.delete_subscription(Subscription {
      course_id: subscription.course_id,
      user_id: subscription.user_id,
    })
    .await
    .unwrap();

    assert_eq!(db.subscriptions().await.unwrap().len(), 0);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn notify_many_subscribers() {
    let TestContext { db, .. } = TestContext::new().await;

    let review = Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      instructors: vec![String::from("bar")],
      rating: 5,
      difficulty: 5,
      user_id: "3".into(),
      timestamp: DateTime::from(Utc::now()),
      ..Review::default()
    };

    let subscription = Subscription {
      course_id: "MATH240".into(),
      user_id: "1".into(),
    };

    db.add_subscription(subscription.clone()).await.unwrap();

    let subscription = Subscription {
      course_id: "MATH240".into(),
      user_id: "2".into(),
    };

    db.add_subscription(subscription.clone()).await.unwrap();

    assert_eq!(db.subscriptions().await.unwrap().len(), 2);

    db.add_notifications(review).await.unwrap();

    assert_eq!(db.notifications().await.unwrap().len(), 2);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn notify_empty_subscribers() {
    let TestContext { db, .. } = TestContext::new().await;

    let review = Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      instructors: vec![String::from("bar")],
      rating: 5,
      difficulty: 5,
      user_id: "1".into(),
      timestamp: DateTime::from(Utc::now()),
      ..Review::default()
    };

    db.add_notifications(review).await.unwrap();

    assert_eq!(db.notifications().await.unwrap().len(), 0);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn dont_notify_review_creator() {
    let TestContext { db, .. } = TestContext::new().await;

    let review = Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      instructors: vec![String::from("bar")],
      rating: 5,
      difficulty: 5,
      user_id: "1".into(),
      timestamp: DateTime::from(Utc::now()),
      ..Review::default()
    };

    let subscription = Subscription {
      course_id: "MATH240".into(),
      user_id: "1".into(),
    };

    db.add_subscription(subscription.clone()).await.unwrap();

    let subscription = Subscription {
      course_id: "MATH240".into(),
      user_id: "2".into(),
    };

    db.add_subscription(subscription.clone()).await.unwrap();

    assert_eq!(db.subscriptions().await.unwrap().len(), 2);

    db.add_notifications(review).await.unwrap();

    assert_eq!(db.notifications().await.unwrap().len(), 1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn delete_subscription() {
    let TestContext { db, .. } = TestContext::new().await;

    let subscription = Subscription {
      course_id: "MATH240".into(),
      user_id: "1".into(),
    };

    db.add_subscription(subscription.clone()).await.unwrap();

    assert_eq!(db.subscriptions().await.unwrap().len(), 1);

    db.delete_subscription(subscription.clone()).await.unwrap();

    assert_eq!(db.subscriptions().await.unwrap().len(), 0);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn delete_notification() {
    let TestContext { db, .. } = TestContext::new().await;

    let review = Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      instructors: vec![String::from("bar")],
      rating: 5,
      difficulty: 5,
      user_id: "3".into(),
      timestamp: DateTime::from(Utc::now()),
      ..Review::default()
    };

    let subscription = Subscription {
      course_id: "MATH240".into(),
      user_id: "1".into(),
    };

    db.add_subscription(subscription.clone()).await.unwrap();

    let subscription = Subscription {
      course_id: "MATH240".into(),
      user_id: "2".into(),
    };

    db.add_subscription(subscription.clone()).await.unwrap();

    assert_eq!(db.subscriptions().await.unwrap().len(), 2);

    db.add_notifications(review.clone()).await.unwrap();

    assert_eq!(db.notifications().await.unwrap().len(), 2);

    db.delete_notification("1", &review.course_id, &review.user_id)
      .await
      .unwrap();

    assert_eq!(db.get_notifications("1").await.unwrap().len(), 0);
    assert_eq!(db.notifications().await.unwrap().len(), 1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn filter_courses_by_query() {
    let TestContext { db, db_name } = TestContext::new().await;

    let tempdir = TempDir::new(&db_name).unwrap();

    let source = tempdir.path().join("courses.json");

    fs::write(&source, get_content("mix.json")).unwrap();

    db.initialize(InitializeOptions {
      source,
      ..Default::default()
    })
    .await
    .unwrap();

    let queries = vec![
      "computer",
      "discrete math",
      "math240",
      "complex analysis",
      "How computer technologies shape social notions such as ownership, safety, and privacy",
    ];

    for query in queries {
      let results = db
        .courses(
          None,
          None,
          Some(CourseFilter {
            query: Some(query.into()),
            ..Default::default()
          }),
        )
        .await
        .unwrap();

      assert!(!results.is_empty());

      for result in results {
        let (a, b) = (
          Regex::new(&format!("(?i).*{}.*", query.replace(' ', ""))).unwrap(),
          Regex::new(&format!("(?i).*{query}.*")).unwrap(),
        );

        assert!(
          a.is_match(&result.id)
            || b.is_match(&result.code)
            || b.is_match(&result.description)
            || b.is_match(&result.subject)
            || b.is_match(&result.title)
        );
      }
    }
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn unique_user_count() {
    let TestContext { db, .. } = TestContext::new().await;

    let rmp_scrape_epoch = Utc.timestamp_opt(1713472800, 0).unwrap();

    let before_epoch = rmp_scrape_epoch - chrono::Duration::hours(1);

    let after_epoch = rmp_scrape_epoch + chrono::Duration::hours(1);

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_course(Course {
      id: "COMP202".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.unique_user_count().await.unwrap(), 0);
    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 0);

    // Add review before epoch - should not be counted
    db.add_review(Review {
      content: "foo".into(),
      course_id: "MATH240".into(),
      user_id: "1".into(),
      timestamp: DateTime::from(before_epoch),
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.unique_user_count().await.unwrap(), 0);
    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 1);

    // Add review after epoch - should be counted
    db.add_review(Review {
      content: "bar".into(),
      course_id: "COMP202".into(),
      user_id: "2".into(),
      timestamp: DateTime::from(after_epoch),
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.unique_user_count().await.unwrap(), 1);
    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 2);

    // Add another review after epoch - should be counted
    db.add_review(Review {
      content: "baz".into(),
      course_id: "COMP202".into(),
      user_id: "1".into(),
      timestamp: DateTime::from(after_epoch),
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.unique_user_count().await.unwrap(), 2);
    assert_eq!(db.reviews(None, None, None).await.unwrap().len(), 3);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn course_count() {
    let TestContext { db, .. } = TestContext::new().await;

    assert_eq!(db.course_count().await.unwrap(), 0);

    db.add_course(Course {
      id: "MATH240".into(),
      ..Default::default()
    })
    .await
    .unwrap();

    assert_eq!(db.course_count().await.unwrap(), 1);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn find_courses_by_instructor_name() {
    let TestContext { db, .. } = TestContext::new().await;

    // Add courses with different instructors
    db.add_course(Course {
      id: "COMP250".into(),
      title: "Fundamentals of SWE".into(),
      instructors: vec![Instructor {
        name: "Lili Wei".into(),
        name_ngrams: None,
        term: "Fall 2024".into(),
      }],
      ..Default::default()
    })
    .await
    .unwrap();

    db.add_course(Course {
      id: "COMP251".into(),
      title: "Algorithms and Data Structures".into(),
      instructors: vec![Instructor {
        name: "Giulia Alberini".into(),
        name_ngrams: None,
        term: "Fall 2024".into(),
      }],
      ..Default::default()
    })
    .await
    .unwrap();

    // Test finding courses by instructor name
    let courses = db
      .find_courses_by_instructor_name("Giulia Alberini")
      .await
      .unwrap();

    assert_eq!(courses.len(), 1);

    let course_ids: Vec<String> =
      courses.iter().map(|c| c.id.clone()).collect();
    assert!(course_ids.contains(&"COMP251".to_string()));

    let empty_courses = db
      .find_courses_by_instructor_name("Nonexistent")
      .await
      .unwrap();
    assert_eq!(empty_courses.len(), 0);
  }
}
