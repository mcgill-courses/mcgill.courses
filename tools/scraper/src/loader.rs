use super::*;

#[derive(Parser)]
pub(crate) struct Loader {
  #[clap(
    long,
    default_value = "20",
    help = "Number of pages to scrape per concurrent batch"
  )]
  batch_size: usize,
  #[clap(
    long,
    default_value = "0",
    help = "Time delay between course requests in milliseconds"
  )]
  course_delay: u64,
  #[clap(
    long,
    default_values = ["2025-2026",],
    help = "The mcgill terms to scrape"
  )]
  mcgill_terms: Vec<String>,
  #[clap(long, default_value = "10", help = "Number of retries")]
  retries: usize,
  #[clap(
    long,
    default_value = "false",
    help = "Scrape visual schedule builder information"
  )]
  scrape_vsb: bool,
  #[clap(long, default_value = "courses.json")]
  source: PathBuf,
  #[clap(long, help = "A user agent")]
  user_agent: String,
  #[clap(
    long,
    default_values = ["202505", "202509", "202601"],
    help = "The schedule builder terms to scrape"
  )]
  vsb_terms: Vec<usize>,
}

impl Loader {
  const BASE_URL: &str = "https://coursecatalogue.mcgill.ca";

  pub(crate) fn run(&self, cookie: &str) -> Result<()> {
    info!(
      "Starting loader: batch_size={}, terms={:?}, vsb_enabled={}, vsb_terms={:?}",
      self.batch_size, self.mcgill_terms, self.scrape_vsb, self.vsb_terms
    );

    for (index, term) in self.mcgill_terms.iter().enumerate() {
      info!(
        "Processing term {} ({}/{})",
        term,
        index + 1,
        self.mcgill_terms.len()
      );

      let scrape_vsb = self.scrape_vsb && index == self.mcgill_terms.len() - 1;

      if scrape_vsb {
        info!("VSB scraping enabled for this term");
      }

      let urls = self.get_course_urls()?;

      info!("Found {} course URLs to scrape", urls.len());

      let mut courses = Vec::new();

      let total_batches = urls.len().div_ceil(self.batch_size);

      for (batch_index, chunk) in urls.chunks(self.batch_size).enumerate() {
        info!(
          "Processing batch {}/{} ({} courses)",
          batch_index + 1,
          total_batches,
          chunk.len()
        );

        let chunk = chunk
          .par_iter()
          .map(|url| {
            self.parse_course(
              &format!("{}{}", Self::BASE_URL, url),
              cookie,
              scrape_vsb,
            )
          })
          .collect::<Result<Vec<Option<Course>>, _>>()?;

        let parsed_count = chunk.iter().filter(|c| c.is_some()).count();

        let skipped_count = chunk.len() - parsed_count;

        info!(
          "Batch {}/{} complete: {} parsed, {} skipped",
          batch_index + 1,
          total_batches,
          parsed_count,
          skipped_count
        );

        courses.extend(chunk.into_iter().flatten());
      }

      let pre_dedup_count = courses.len();

      let mut courses = courses
        .into_iter()
        .collect::<HashSet<Course>>()
        .into_iter()
        .filter(|course| !course.title.is_empty())
        .collect::<Vec<Course>>();

      courses.sort();

      let empty_title_count = pre_dedup_count - courses.len();

      if empty_title_count > 0 {
        warn!(
          "Filtered out {} courses with empty titles",
          empty_title_count
        );
      }

      info!(
        "Deduplication complete: {} unique courses (removed {} duplicates)",
        courses.len(),
        pre_dedup_count.saturating_sub(courses.len())
      );

      let source = if self.source.is_dir() {
        self.source.join(format!("courses-{term}.json"))
      } else {
        self.source.clone()
      };

      if source.exists() {
        let sourced =
          serde_json::from_str::<Vec<Course>>(&fs::read_to_string(&source)?)?;

        info!(
          "Merging with existing file {:?}: {} existing courses + {} new courses",
          source,
          sourced.len(),
          courses.len()
        );

        let mut merged = courses
          .iter()
          .map(|course| {
            sourced
              .iter()
              .find(|sourced| sourced.id == course.id)
              .map(|sourced| sourced.clone().merge(course.clone()))
              .unwrap_or_else(|| course.clone())
          })
          .collect::<Vec<Course>>();

        let courses = &self.post_process(&mut merged)?;

        fs::write(&source, serde_json::to_string_pretty(&courses)?)?;

        info!("Wrote {} courses to {:?}", courses.len(), source);
      } else {
        info!("Creating new file {:?}", source);

        let processed = self.post_process(&mut courses)?;

        fs::write(&source, serde_json::to_string_pretty(&processed)?)?;

        info!("Wrote {} courses to {:?}", processed.len(), source);
      }
    }

    info!("Loader finished successfully");

    Ok(())
  }

  fn post_process(&self, courses: &mut [Course]) -> Result<Vec<Course>> {
    info!(
      "Post processing {} courses: computing leading_to relationships",
      courses.len()
    );

    let mapping = courses
      .iter()
      .enumerate()
      .map(|(index, course)| {
        (
          index,
          courses
            .iter()
            .filter(|other| {
              other.id != course.id && other.prerequisites.contains(&course.id)
            })
            .map(|other| other.id.clone())
            .collect(),
        )
      })
      .collect::<Vec<(usize, Vec<String>)>>();

    for (i, leading_to) in mapping {
      courses[i].leading_to = leading_to;
    }

    let courses_with_leading_to = courses
      .iter()
      .filter(|course| !course.leading_to.is_empty())
      .count();

    info!(
      "Post processing complete: {} courses have leading_to relationships",
      courses_with_leading_to
    );

    Ok(courses.to_vec())
  }

  fn get_course_urls(&self) -> Result<Vec<String>> {
    info!("Fetching course catalog from {}/courses", Self::BASE_URL);

    let client = Client::builder().user_agent(&self.user_agent).build()?;

    let page = client
      .get(format!("{}/courses", Self::BASE_URL))
      .retry(self.retries)?
      .text()?;

    let urls = course_extractor::extract_course_urls(&page)?;

    info!("Extracted {} course URLs from catalog", urls.len());

    Ok(urls)
  }

  fn parse_course(
    &self,
    url: &str,
    cookie: &str,
    scrape_vsb: bool,
  ) -> Result<Option<Course>> {
    let client = Client::builder().user_agent(&self.user_agent).build()?;

    let course_page = {
      let response = client.get(url).retry(self.retries)?;

      if response.status() == reqwest::StatusCode::NOT_FOUND {
        warn!("Course page not found (404): {}", url);
        return Ok(None);
      }

      let mut course_page =
        course_extractor::extract_course_page(&response.text()?);

      let mut retry_count = 0;

      while course_page.is_err() {
        if retry_count >= self.retries {
          warn!(
            "Failed to parse course page after {} retries, skipping: {} - {:?}",
            self.retries,
            url,
            course_page.as_ref().err()
          );

          return Ok(None);
        }

        retry_count += 1;

        warn!(
          "Failed to parse course page, retrying ({}/{}): {} - {:?}",
          retry_count,
          self.retries,
          url,
          course_page.as_ref().err()
        );

        thread::sleep(Duration::from_millis(500));

        let response = client.get(url).retry(self.retries)?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
          warn!("Course page not found (404) on retry: {}", url);
          return Ok(None);
        };

        course_page = course_extractor::extract_course_page(&response.text()?);
      }

      course_page?
    };

    info!(
      "Parsed {}{}: \"{}\" ({} credits)",
      &course_page.subject,
      &course_page.code,
      &course_page.title,
      &course_page.credits
    );

    thread::sleep(Duration::from_millis(self.course_delay));

    let course_id = format!("{}-{}", course_page.subject, course_page.code);

    let schedule = if scrape_vsb {
      info!("Fetching VSB schedule for {}", course_id);

      let vsb_schedule =
        VsbClient::new(&self.user_agent, cookie, self.retries)?
          .schedule(&course_id, self.vsb_terms.clone())?;

      info!(
        "Retrieved {} schedule entries from VSB for {}",
        vsb_schedule.len(),
        course_id
      );

      Some(vsb_schedule)
    } else {
      None
    };

    // Temporarily using VSB information to get term/instructor info
    // since course catalogue doesn't have it...
    let schedule_info = schedule.clone().map(|schedules| {
      let mut terms = schedules
        .iter()
        .filter_map(|schedule| schedule.term.clone())
        .collect::<Vec<_>>();

      utils::dedup(&mut terms);

      let mut instructors = Vec::new();

      for schedule in schedules {
        if let Some(blocks) = schedule.blocks {
          for block in blocks {
            for instructor in block.instructors {
              info!(
                "[{}] Extracted instructor: '{}' (term: {})",
                course_id,
                instructor,
                schedule.term.as_deref().unwrap_or("unknown")
              );

              instructors.push(Instructor {
                name: instructor,
                term: schedule.term.clone().unwrap_or_default(),
                ..Default::default()
              });
            }
          }
        }
      }

      let pre_dedup_instructors = instructors.len();

      utils::dedup(&mut instructors);

      if !instructors.is_empty() {
        info!(
          "[{}] Found {} unique instructors for {} terms (removed {} duplicates)",
          course_id,
          instructors.len(),
          terms.len(),
          pre_dedup_instructors - instructors.len()
        );
      }

      (terms, instructors)
    });

    Ok(Some(Course {
      id: format!("{}{}", course_page.subject, course_page.code),
      id_ngrams: None,
      title: course_page.title.clone(),
      title_ngrams: None,
      credits: course_page.credits,
      subject: course_page.subject.clone(),
      code: course_page.code.clone(),
      url: url.to_string(),
      department: course_page.department.unwrap_or_default(),
      faculty: course_page.faculty.unwrap_or_default(),
      terms: schedule_info
        .as_ref()
        .map(|s| s.0.clone())
        .unwrap_or(course_page.terms),
      description: course_page.description,
      instructors: schedule_info
        .as_ref()
        .map(|s| s.1.clone())
        .unwrap_or(course_page.instructors),
      prerequisites_text: course_page.requirements.prerequisites_text,
      corequisites_text: course_page.requirements.corequisites_text,
      prerequisites: course_page.requirements.prerequisites,
      corequisites: course_page.requirements.corequisites,
      leading_to: Vec::new(),
      restrictions: course_page.requirements.restrictions,
      logical_prerequisites: course_page.requirements.logical_prerequisites,
      logical_corequisites: course_page.requirements.logical_corequisites,
      schedule,
      ..Default::default()
    }))
  }
}
