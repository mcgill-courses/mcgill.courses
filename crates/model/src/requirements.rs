use super::*;

pub enum Requirement {
  Corequisites,
  Prerequisites,
  Restrictions,
  Unknown,
}

impl From<&str> for Requirement {
  fn from(s: &str) -> Self {
    match s {
      "Corequisite" => Self::Corequisites,
      "Prerequisite" => Self::Prerequisites,
      "Restriction" => Self::Restrictions,
      _ => Self::Unknown,
    }
  }
}

#[derive(
  Debug,
  PartialEq,
  Eq,
  Serialize,
  Deserialize,
  Clone,
  Hash,
  Ord,
  PartialOrd,
  ToSchema,
)]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub enum Operator {
  /// All requirements must be satisfied.
  #[serde(rename = "AND")]
  And,
  /// Any requirement may be satisfied.
  #[serde(rename = "OR")]
  Or,
}

impl Into<Bson> for Operator {
  fn into(self) -> Bson {
    match self {
      Self::And => Bson::String("AND".to_string()),
      Self::Or => Bson::String("OR".to_string()),
    }
  }
}

#[derive(
  Debug, PartialEq, Eq, Serialize, Clone, Hash, Ord, PartialOrd, ToSchema,
)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase")]
#[typeshare]
pub enum RequirementNode {
  /// A single course code requirement.
  Course(String),
  #[schema(no_recursion)]
  /// A group of requirement nodes combined by an operator.
  Group {
    /// Operator used to combine the child nodes.
    operator: Operator,
    /// Child requirement nodes in the group.
    groups: Vec<RequirementNode>,
  },
}

impl<'de> Deserialize<'de> for RequirementNode {
  /// Deserializes RequirementNode from either old untagged format or new tagged format for
  /// backward compatibility.
  ///
  /// This function handles two different RequirementNode serialization formats during
  /// deserialization. The new format uses serde's tagged enum representation with
  /// explicit type discriminators: `{type: "course", data: "MATH240"}` for courses
  /// and `{type: "group", data: {operator: "AND", groups: [...]}}` for groups.
  /// This matches the typeshare-generated TypeScript types that provide type safety
  /// on the frontend.
  ///
  /// However, existing database records contain the old untagged format where courses
  /// are stored as plain strings (e.g., `"MATH240"`) and groups as objects without
  /// type discriminators (e.g., `{operator: "AND", groups: [...]}`).
  ///
  /// The dual format support exists because historical course data in the database
  /// was stored using an untagged enum representation before we introduced typeshare
  /// for frontend-backend type consistency. This custom deserializer allows the
  /// backend to read existing data while serializing new data in the tagged format
  /// for future writes.
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: serde::Deserializer<'de>,
  {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GroupData {
      operator: Operator,
      groups: Vec<RequirementNode>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", tag = "type", content = "data")]
    enum TaggedRequirementNode {
      Course(String),
      Group(GroupData),
    }

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum UntaggedRequirementNode {
      Course(String),
      Group(GroupData),
    }

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum RequirementNodeRepr {
      Tagged(TaggedRequirementNode),
      Legacy(UntaggedRequirementNode),
    }

    let repr = RequirementNodeRepr::deserialize(deserializer)?;

    Ok(match repr {
      RequirementNodeRepr::Tagged(TaggedRequirementNode::Course(course))
      | RequirementNodeRepr::Legacy(UntaggedRequirementNode::Course(course)) => {
        RequirementNode::Course(course)
      }
      RequirementNodeRepr::Tagged(TaggedRequirementNode::Group(group))
      | RequirementNodeRepr::Legacy(UntaggedRequirementNode::Group(group)) => {
        let GroupData { operator, groups } = group;
        RequirementNode::Group { operator, groups }
      }
    })
  }
}

impl Into<Bson> for RequirementNode {
  fn into(self) -> Bson {
    match self {
      Self::Course(course) => Bson::String(course),
      Self::Group { operator, groups } => Bson::Document(doc! {
        "operator": <Operator as Into<Bson>>::into(operator),
        "groups": groups.into_iter().map(|group| group.into()).collect::<Vec<Bson>>()
      }),
    }
  }
}

impl Default for RequirementNode {
  fn default() -> Self {
    Self::Course("".to_string())
  }
}

impl RequirementNode {
  pub fn validate(self, candidates: &[String]) -> Result<Option<Self>, String> {
    match self {
      Self::Course(course) => {
        if candidates.contains(&course) {
          Ok(Some(Self::Course(course)))
        } else {
          Err(format!("model returned non-candidate course {course:?}"))
        }
      }
      Self::Group { operator, groups } => {
        let mut groups = groups
          .into_iter()
          .map(|group| group.validate(candidates))
          .collect::<Result<Vec<_>, _>>()?
          .into_iter()
          .flatten()
          .collect::<Vec<_>>();

        Ok(match groups.len() {
          0 => None,
          1 => groups.pop(),
          _ => Some(Self::Group { operator, groups }),
        })
      }
    }
  }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Requirements {
  pub prerequisites_text: Option<String>,
  pub corequisites_text: Option<String>,
  pub corequisites: Vec<String>,
  pub prerequisites: Vec<String>,
  pub restrictions: Option<String>,
  pub logical_prerequisites: Option<RequirementNode>,
  pub logical_corequisites: Option<RequirementNode>,
}

impl Requirements {
  pub fn set_prerequisites_text(&mut self, prerequisites_text: Option<String>) {
    self.prerequisites_text = prerequisites_text;
  }

  pub fn set_corequisites_text(&mut self, corequisites_text: Option<String>) {
    self.corequisites_text = corequisites_text;
  }

  pub fn set_corequisites(&mut self, corequisites: Vec<String>) {
    self.corequisites = corequisites;
  }

  pub fn set_prerequisites(&mut self, prerequisites: Vec<String>) {
    self.prerequisites = prerequisites;
  }

  pub fn set_restrictions(&mut self, restrictions: String) {
    self.restrictions = Some(restrictions);
  }

  pub fn set_logical_prerequisites(
    &mut self,
    logical_prerequisites: Option<RequirementNode>,
  ) {
    self.logical_prerequisites = logical_prerequisites;
  }

  pub fn set_logical_corequisites(
    &mut self,
    logical_corequisites: Option<RequirementNode>,
  ) {
    self.logical_corequisites = logical_corequisites;
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn validate_flattens_single_child_groups() {
    assert_eq!(
      RequirementNode::Group {
        operator: Operator::And,
        groups: vec![
          RequirementNode::Course("FOOO 100".to_string()),
          RequirementNode::Group {
            operator: Operator::Or,
            groups: vec![RequirementNode::Course("BARR 200".to_string())],
          },
        ],
      }
      .validate(&["BARR 200".to_string(), "FOOO 100".to_string()])
      .unwrap(),
      Some(RequirementNode::Group {
        operator: Operator::And,
        groups: vec![
          RequirementNode::Course("FOOO 100".to_string()),
          RequirementNode::Course("BARR 200".to_string()),
        ],
      }),
    );
  }

  #[test]
  fn validate_rejects_non_candidate_courses() {
    assert_eq!(
      RequirementNode::Course("BARR 200".to_string())
        .validate(&["FOOO 100".to_string()])
        .unwrap_err(),
      "model returned non-candidate course \"BARR 200\"",
    );
  }
}
