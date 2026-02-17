use super::*;

#[derive(
  Clone, Debug, Default, Deserialize, Derivative, Serialize, ToSchema,
)]
#[derivative(Eq, Hash, PartialEq)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub struct Course {
  /// Unique course identifier.
  #[serde(rename = "_id")]
  pub id: String,
  /// Search n-grams for the course ID.
  pub id_ngrams: Option<String>,
  /// Course title.
  pub title: String,
  /// Search n-grams for the course title.
  pub title_ngrams: Option<String>,
  /// Credit value as listed in the catalog.
  pub credits: String,
  /// Subject code (e.g., "COMP").
  pub subject: String,
  /// Course number (e.g., "202").
  pub code: String,
  /// Catalog URL for the course.
  pub url: String,
  /// Department offering the course.
  pub department: String,
  /// Faculty offering the course.
  pub faculty: String,
  /// Terms when the course is offered.
  pub terms: Vec<Term>,
  /// Course description.
  pub description: String,
  /// Instructors associated with the course.
  pub instructors: Vec<Instructor>,
  /// Raw prerequisites text from the catalog.
  pub prerequisites_text: Option<String>,
  /// Raw corequisites text from the catalog.
  pub corequisites_text: Option<String>,
  /// List of prerequisite course codes.
  pub prerequisites: Vec<String>,
  /// List of corequisite course codes.
  pub corequisites: Vec<String>,
  /// Course codes that list this course as a prerequisite.
  pub leading_to: Vec<String>,
  /// Structured prerequisites expression.
  pub logical_prerequisites: Option<ReqNode>,
  /// Structured corequisites expression.
  pub logical_corequisites: Option<ReqNode>,
  /// Restriction text from the catalog.
  pub restrictions: Option<String>,
  /// Schedule offerings for the course.
  pub schedule: Option<Vec<Schedule>>,
  /// Average rating across reviews.
  #[derivative(PartialEq = "ignore")]
  #[derivative(Hash = "ignore")]
  #[serde(default = "zero_f32")]
  pub avg_rating: f32,
  /// Average difficulty across reviews.
  #[derivative(PartialEq = "ignore")]
  #[derivative(Hash = "ignore")]
  #[serde(default = "zero_f32")]
  pub avg_difficulty: f32,
  /// Number of reviews for the course.
  #[derivative(PartialEq = "ignore")]
  #[derivative(Hash = "ignore")]
  #[serde(default = "zero")]
  pub review_count: i32,
}

const fn zero() -> i32 {
  0
}

const fn zero_f32() -> f32 {
  0.0
}

impl Ord for Course {
  fn cmp(&self, other: &Self) -> std::cmp::Ordering {
    self.id.cmp(&other.id)
  }
}

impl PartialOrd for Course {
  fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
    Some(self.cmp(other))
  }
}

impl Course {
  pub fn merge(self, other: Course) -> Course {
    let other_terms = other
      .instructors
      .iter()
      .map(|instructor| &instructor.term)
      .collect::<HashSet<_>>();

    let mut instructors = self
      .instructors
      .into_iter()
      .filter(|instructor| !other_terms.contains(&instructor.term))
      .collect::<Vec<_>>();

    instructors.extend(other.instructors);

    Course {
      instructors,
      logical_corequisites: other
        .logical_corequisites
        .or(self.logical_corequisites),
      logical_prerequisites: other
        .logical_prerequisites
        .or(self.logical_prerequisites),
      schedule: Some(self.schedule.combine_opt(other.schedule)),
      terms: self.terms.combine(other.terms),
      ..other
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn instructor(name: &str, term: &str) -> Instructor {
    Instructor {
      name: name.to_string(),
      name_ngrams: None,
      term: term.parse().unwrap(),
    }
  }

  fn schedule(term: &str) -> Schedule {
    Schedule {
      term: Some(term.parse().unwrap()),
      blocks: None,
    }
  }

  fn course() -> Course {
    Course {
      id: "COMP-202".to_string(),
      title: "Foundations of Programming".to_string(),
      credits: "3".to_string(),
      subject: "COMP".to_string(),
      code: "202".to_string(),
      url: "https://www.mcgill.ca/study/courses/comp-202".to_string(),
      department: "Computer Science".to_string(),
      faculty: "Science".to_string(),
      description: "Introduction to programming".to_string(),
      ..Default::default()
    }
  }

  #[test]
  fn merge_instructors_replaces_same_term() {
    let course1 = Course {
      instructors: vec![
        instructor("Alice Smith", "Fall 2024"),
        instructor("Bob Jones", "Winter 2024"),
      ],
      ..course()
    };

    let course2 = Course {
      instructors: vec![instructor("Charlie Brown", "Fall 2024")],
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(
      merged.instructors,
      vec![
        instructor("Bob Jones", "Winter 2024"),
        instructor("Charlie Brown", "Fall 2024"),
      ]
    );
  }

  #[test]
  fn merge_instructors_keeps_non_overlapping_terms() {
    let course1 = Course {
      instructors: vec![
        instructor("Alice Smith", "Fall 2023"),
        instructor("Bob Jones", "Winter 2023"),
      ],
      ..course()
    };

    let course2 = Course {
      instructors: vec![instructor("Charlie Brown", "Fall 2024")],
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(
      merged.instructors,
      vec![
        instructor("Alice Smith", "Fall 2023"),
        instructor("Bob Jones", "Winter 2023"),
        instructor("Charlie Brown", "Fall 2024"),
      ]
    );
  }

  #[test]
  fn merge_instructors_empty_other() {
    let course1 = Course {
      instructors: vec![instructor("Alice Smith", "Fall 2024")],
      ..course()
    };

    let course2 = Course {
      instructors: vec![],
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(
      merged.instructors,
      vec![instructor("Alice Smith", "Fall 2024")]
    );
  }

  #[test]
  fn merge_instructors_empty_self() {
    let course1 = Course {
      instructors: vec![],
      ..course()
    };

    let course2 = Course {
      instructors: vec![instructor("Alice Smith", "Fall 2024")],
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(
      merged.instructors,
      vec![instructor("Alice Smith", "Fall 2024")]
    );
  }

  #[test]
  fn merge_logical_prerequisites_prefers_other() {
    let self_prereq = ReqNode::Course("MATH-140".to_string());
    let other_prereq = ReqNode::Course("MATH-141".to_string());

    let course1 = Course {
      logical_prerequisites: Some(self_prereq),
      ..course()
    };

    let course2 = Course {
      logical_prerequisites: Some(other_prereq.clone()),
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(merged.logical_prerequisites, Some(other_prereq));
  }

  #[test]
  fn merge_logical_prerequisites_falls_back_to_self() {
    let self_prereq = ReqNode::Course("MATH-140".to_string());

    let course1 = Course {
      logical_prerequisites: Some(self_prereq.clone()),
      ..course()
    };

    let course2 = Course {
      logical_prerequisites: None,
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(merged.logical_prerequisites, Some(self_prereq));
  }

  #[test]
  fn merge_logical_corequisites_prefers_other() {
    let self_coreq = ReqNode::Course("COMP-206".to_string());
    let other_coreq = ReqNode::Course("COMP-250".to_string());

    let course1 = Course {
      logical_corequisites: Some(self_coreq),
      ..course()
    };

    let course2 = Course {
      logical_corequisites: Some(other_coreq.clone()),
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(merged.logical_corequisites, Some(other_coreq));
  }

  #[test]
  fn merge_logical_corequisites_falls_back_to_self() {
    let self_coreq = ReqNode::Course("COMP-206".to_string());

    let course1 = Course {
      logical_corequisites: Some(self_coreq.clone()),
      ..course()
    };

    let course2 = Course {
      logical_corequisites: None,
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(merged.logical_corequisites, Some(self_coreq));
  }

  #[test]
  fn merge_terms_combines_unique() {
    let course1 = Course {
      terms: vec!["Fall 2023".parse().unwrap(), "Winter 2024".parse().unwrap()],
      ..course()
    };

    let course2 = Course {
      terms: vec!["Winter 2024".parse().unwrap(), "Fall 2024".parse().unwrap()],
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(
      merged.terms,
      vec![
        "Fall 2023".parse::<Term>().unwrap(),
        "Winter 2024".parse::<Term>().unwrap(),
        "Fall 2024".parse::<Term>().unwrap(),
      ]
    );
  }

  #[test]
  fn merge_schedule_combines() {
    let course1 = Course {
      schedule: Some(vec![schedule("Fall 2023")]),
      ..course()
    };

    let course2 = Course {
      schedule: Some(vec![schedule("Fall 2024")]),
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(
      merged.schedule,
      Some(vec![schedule("Fall 2023"), schedule("Fall 2024")])
    );
  }

  #[test]
  fn merge_schedule_handles_none_self() {
    let course1 = Course {
      schedule: None,
      ..course()
    };

    let course2 = Course {
      schedule: Some(vec![schedule("Fall 2024")]),
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(merged.schedule, Some(vec![schedule("Fall 2024")]));
  }

  #[test]
  fn merge_schedule_handles_none_other() {
    let course1 = Course {
      schedule: Some(vec![schedule("Fall 2023")]),
      ..course()
    };

    let course2 = Course {
      schedule: None,
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(merged.schedule, Some(vec![schedule("Fall 2023")]));
  }

  #[test]
  fn merge_uses_other_for_basic_fields() {
    let course1 = Course {
      id: "COMP-202".to_string(),
      title: "Old Title".to_string(),
      description: "Old description".to_string(),
      credits: "3".to_string(),
      ..course()
    };

    let course2 = Course {
      id: "COMP-202".to_string(),
      title: "New Title".to_string(),
      description: "New description".to_string(),
      credits: "4".to_string(),
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(merged.title, "New Title");
    assert_eq!(merged.description, "New description");
    assert_eq!(merged.credits, "4");
  }

  #[test]
  fn merge_complex_logical_prerequisites() {
    let self_prereq = ReqNode::Group {
      operator: Operator::And,
      groups: vec![
        ReqNode::Course("MATH-140".to_string()),
        ReqNode::Course("MATH-141".to_string()),
      ],
    };

    let other_prereq = ReqNode::Group {
      operator: Operator::Or,
      groups: vec![
        ReqNode::Course("MATH-150".to_string()),
        ReqNode::Course("MATH-151".to_string()),
      ],
    };

    let course1 = Course {
      logical_prerequisites: Some(self_prereq),
      ..course()
    };

    let course2 = Course {
      logical_prerequisites: Some(other_prereq.clone()),
      ..course()
    };

    let merged = course1.merge(course2);

    assert_eq!(merged.logical_prerequisites, Some(other_prereq));
  }
}
