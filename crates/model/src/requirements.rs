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
pub enum ReqNode {
  /// A single course code requirement.
  Course(String),
  #[schema(no_recursion)]
  /// A group of requirement nodes combined by an operator.
  Group {
    /// Operator used to combine the child nodes.
    operator: Operator,
    /// Child requirement nodes in the group.
    groups: Vec<ReqNode>,
  },
}

impl<'de> Deserialize<'de> for ReqNode {
  /// Deserializes ReqNode from either old untagged format or new tagged format for
  /// backward compatibility.
  ///
  /// This function handles two different ReqNode serialization formats during
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
      groups: Vec<ReqNode>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", tag = "type", content = "data")]
    enum TaggedReqNode {
      Course(String),
      Group(GroupData),
    }

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum UntaggedReqNode {
      Course(String),
      Group(GroupData),
    }

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum ReqNodeRepr {
      Tagged(TaggedReqNode),
      Legacy(UntaggedReqNode),
    }

    let repr = ReqNodeRepr::deserialize(deserializer)?;

    Ok(match repr {
      ReqNodeRepr::Tagged(TaggedReqNode::Course(course))
      | ReqNodeRepr::Legacy(UntaggedReqNode::Course(course)) => {
        ReqNode::Course(course)
      }
      ReqNodeRepr::Tagged(TaggedReqNode::Group(group))
      | ReqNodeRepr::Legacy(UntaggedReqNode::Group(group)) => {
        let GroupData { operator, groups } = group;
        ReqNode::Group { operator, groups }
      }
    })
  }
}

impl Into<Bson> for ReqNode {
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

impl Default for ReqNode {
  fn default() -> Self {
    Self::Course("".to_string())
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
  pub logical_prerequisites: Option<ReqNode>,
  pub logical_corequisites: Option<ReqNode>,
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
    logical_prerequisites: Option<ReqNode>,
  ) {
    self.logical_prerequisites = logical_prerequisites;
  }

  pub fn set_logical_corequisites(
    &mut self,
    logical_corequisites: Option<ReqNode>,
  ) {
    self.logical_corequisites = logical_corequisites;
  }
}
