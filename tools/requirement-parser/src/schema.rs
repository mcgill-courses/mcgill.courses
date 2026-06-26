use super::*;

#[derive(Debug, Deserialize)]
pub(super) struct RequirementResponse {
  pub(super) requirement: Option<RequirementNode>,
}

pub(super) struct RequirementSchema<'a> {
  candidates: &'a [String],
}

impl<'a> RequirementSchema<'a> {
  pub(super) fn new(candidates: &'a [String]) -> Self {
    Self { candidates }
  }

  pub(super) fn response_format(&self) -> ResponseFormat {
    ResponseFormat::JsonSchema {
      json_schema: ResponseFormatJsonSchema {
        description: None,
        name: "course_requirement".to_string(),
        strict: Some(true),
        schema: json!({
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "requirement": {
              "anyOf": [
                { "$ref": "#/$defs/requirementNode" },
                { "type": "null" }
              ]
            }
          },
          "required": ["requirement"],
          "$defs": {
            "course": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "type": { "enum": ["course"] },
                "data": { "type": "string", "enum": self.candidates }
              },
              "required": ["type", "data"]
            },
            "group": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "type": { "enum": ["group"] },
                "data": { "$ref": "#/$defs/groupData" }
              },
              "required": ["type", "data"]
            },
            "groupData": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "operator": { "enum": ["AND", "OR"] },
                "groups": {
                  "type": "array",
                  "items": { "$ref": "#/$defs/requirementNode" }
                }
              },
              "required": ["operator", "groups"]
            },
            "requirementNode": {
              "anyOf": [
                { "$ref": "#/$defs/course" },
                { "$ref": "#/$defs/group" }
              ]
            }
          }
        }),
      },
    }
  }
}
