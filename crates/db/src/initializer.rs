use super::*;

#[derive(Debug)]
pub(crate) struct Initializer {
  db: Db,
  options: InitializeOptions,
}

impl Initializer {
  const COURSE_COLLECTION: &'static str = "courses";
  const INSTRUCTOR_COLLECTION: &'static str = "instructors";

  pub(crate) fn new(db: Db, options: InitializeOptions) -> Self {
    Self { db, options }
  }

  pub(crate) async fn run(&self) -> Result {
    self.index().await?;
    self.seed().await?;
    Ok(())
  }

  fn collect(&self) -> Result<Vec<Seed>> {
    Ok(if self.options.source.is_file() {
      vec![Seed::from_content(
        self.options.source.clone(),
        fs::read_to_string(&self.options.source)?,
      )]
    } else {
      fs::read_dir(&self.options.source)?
        .map(|path| -> Result<PathBuf> { Ok(path?.path()) })
        .collect::<Result<Vec<_>>>()?
        .into_iter()
        .sorted()
        .map(|path| -> Result<Seed> {
          Ok(Seed::from_content(path.clone(), fs::read_to_string(path)?))
        })
        .collect::<Result<Vec<_>>>()?
    })
  }

  async fn index(&self) -> Result {
    info!("Building course index...");

    self
      .db
      .create_index::<Course>(
        "courses_text_search",
        Self::COURSE_COLLECTION,
        doc! {
          "subject": "text",
          "code": "text",
          "_id": "text",
          "title": "text",
          "idNgrams": "text",
          "titleNgrams": "text",
        },
        doc! {
          "subject": 10,
          "code": 10,
          "_id": 10,
          "title": 8,
          "idNgrams": 4,
          "titleNgrams": 2,
        },
      )
      .await?;

    info!("Building instructor index...");

    self
      .db
      .create_index::<Instructor>(
        "instructors_text_search",
        Self::INSTRUCTOR_COLLECTION,
        doc! { "name": "text", "nameNgrams": "text" },
        doc! { "name": 10, "nameNgrams": 4 },
      )
      .await?;

    info!("All indices complete.");

    Ok(())
  }

  async fn populate<
    Item: Clone + Send,
    Fut: Future<Output = Result> + Send + 'static,
    F: Fn(Db, Item) -> Fut,
  >(
    &self,
    items: Vec<Item>,
    runner: F,
  ) -> Result {
    let tasks =
      self
        .options
        .multithreaded
        .then_some(items.clone().into_iter().map(|item| {
          let db = self.db.clone();
          tokio::task::spawn(runner(db, item))
        }));

    if let Some(tasks) = tasks {
      join_all(tasks)
        .await
        .into_iter()
        .try_for_each(|result| result?)?;
    } else {
      for item in items {
        runner(self.db.clone(), item).await?;
      }
    }

    Ok(())
  }

  async fn seed(&self) -> Result {
    info!("Seeding the database...");

    let mut seeds = self.collect()?;

    if self.options.latest_courses {
      let courses = seeds
        .clone()
        .into_iter()
        .filter(|seed| matches!(seed, Seed::Courses(_)))
        .collect::<Vec<Seed>>();

      seeds.retain(|seed| !matches!(seed, Seed::Courses(_)));

      if let Some(last) = courses.last() {
        seeds.insert(0, last.clone());
      }
    }

    for seed in seeds {
      match seed {
        Seed::Averages((path, averages)) => {
          info!("Seeding averages from {}...", path.display());

          let runner = |db: Db, item: CourseAverage| async move {
            db.add_average(item).await?;
            Ok(())
          };

          self.populate(averages, runner).await?;
        }
        Seed::Courses((path, courses)) if !self.options.skip_courses => {
          info!("Seeding courses from {}...", path.display());

          let runner = |db: Db, item: Course| async move {
            db.add_course(item.clone()).await?;

            for instructor in item.instructors {
              db.add_instructor(instructor).await?;
            }

            Ok(())
          };

          self.populate(courses, runner).await?;
        }
        Seed::Reviews((path, reviews)) if !self.options.skip_reviews => {
          info!("Seeding reviews from {}...", path.display());

          let runner = |db: Db, item: Review| async move {
            db.add_review(item).await?;
            Ok(())
          };

          self.populate(reviews, runner).await?;
        }
        Seed::Unknown(path) => {
          warn!(
            "Unknown seed type encountered from {}, continuing...",
            path.display()
          );
        }
        _ => continue,
      }
    }

    info!("Seeding complete.");

    Ok(())
  }
}
