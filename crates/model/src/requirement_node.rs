use super::*;

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
  /// Supports both the current tagged format and legacy untagged requirement
  /// nodes already stored in seed data and the database.
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
