## final-exam-schedule-parser

**final-exam-schedule-parser** is the tool we use to update final exam data
from McGill's official exam schedule PDFs. It extracts course sections, exam
format, exam type, location, and start and end times, then writes the JSON file
imported by the frontend.

The parser can fetch a PDF from a URL, or read a local PDF file. It namespaces
the parsed exams under the term passed on the command line, such as
`Fall 2025` or `Winter 2026`.

## Usage

You can invoke `final-exam-schedule-parser` from the repository root as follows:

```bash
cargo run -p final-exam-schedule-parser -- \
  --term "Winter 2026" \
  --url "https://www.mcgill.ca/exams/files/exams/april_2026_final_schedulef18.pdf"
```

The `--output` flag specifies the JSON file to write (default:
`client/src/assets/final-exams.json`).

```bash
cargo run -p final-exam-schedule-parser -- \
  --term "Winter 2026" \
  --url "https://www.mcgill.ca/exams/files/exams/april_2026_final_schedulef18.pdf" \
  --output client/src/assets/final-exams.json
```

The `--source` flag reads a local PDF instead of fetching the PDF from
`--url`. The URL is still written to the output JSON so the frontend can link
back to the official source.

```bash
cargo run -p final-exam-schedule-parser -- \
  --source final-exams.pdf \
  --term "Winter 2026" \
  --url "https://www.mcgill.ca/exams/files/exams/april_2026_final_schedulef18.pdf"
```

## Input

The parser expects McGill's exam schedule PDF format, where each exam entry
contains a course identifier, section number, exam details, start time, and end
time.

Exam detail lines are split into:

| Segment | Description |
| ------- | ----------- |
| `format` | Exam format, such as `IN-PERSON` or `ONLINE` |
| `type` | Exam type, such as `FORMAL EXAM` |
| `location` | Optional exam location |

Date and time lines are parsed from values such as
`28-Apr-2026 at 02:00 PM`.

## Output

The output JSON is a final exam group written to
`client/src/assets/final-exams.json` by default:

| Field | Description |
| ----- | ----------- |
| `term` | Term name passed with `--term` |
| `url` | Official source PDF URL passed with `--url` |
| `exams` | Parsed final exams |

Each exam object contains:

| Field | Description |
| ----- | ----------- |
| `id` | Course identifier |
| `section` | Course section |
| `format` | Exam format |
| `type` | Exam type |
| `location` | Optional exam location |
| `startTime` | Exam start time in ISO 8601 format |
| `endTime` | Exam end time in ISO 8601 format |
