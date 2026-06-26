## requirement-parser

**requirement-parser** is the tool we use to generate structured prerequisite
and corequisite expression trees for scraped course seed files. It reads course
JSON, parses the requirement text for each course, and writes
`logicalPrerequisites` and `logicalCorequisites` fields back to the same file.

<br/>
<div align='center'>
  <img style='border-radius: 8px' width='500' src='https://github.com/terror/mcgill.courses/assets/31192478/de8f3f42-d3f5-4eac-9137-f9793bc877a3'/>
</div>
<br/>

The tool extracts candidate course codes from the existing course arrays and
requirement text, asks an OpenAI model for a schema-constrained JSON expression
tree, and validates every returned course code against the candidate set before
writing output.

## Usage

You can invoke `requirement-parser` from within this directory as follows:

```bash
cargo run -- ../../seed/courses-2024-2025.json
```

The `--delay` flag controls the delay between OpenAI requests in milliseconds
(default: 1000). The `--overwrite` flag reparses courses that already have
logical requirement fields.

```bash
cargo run -- --delay 0 --overwrite ../../seed/courses-2024-2025.json
```

## Authentication

Parsing through OpenAI requires the following environment variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL_NAME` | Model used for schema-constrained requirement parsing |

## Input

The parser reads a course seed JSON file containing course objects. For each
course, it uses these fields:

| Field | Description |
|-------|-------------|
| `prerequisitesText` | Raw prerequisite text from the catalogue |
| `corequisitesText` | Raw corequisite text from the catalogue |
| `prerequisites` | Deterministically scraped prerequisite course IDs |
| `corequisites` | Deterministically scraped corequisite course IDs |
| `logicalPrerequisites` | Existing parsed prerequisite tree |
| `logicalCorequisites` | Existing parsed corequisite tree |

Courses with existing logical requirement fields are skipped unless
`--overwrite` is passed. Courses listed in `failed.txt` are skipped on later
runs.

## Output

The parser writes the updated course array back to the input file. Logical
requirements are stored as `ReqNode` JSON:

| Field | Description |
|-------|-------------|
| `logicalPrerequisites` | Structured prerequisite expression tree |
| `logicalCorequisites` | Structured corequisite expression tree |

If a course fails to parse, its course ID is appended to `failed.txt` in the
current working directory.
