## course-average-fetcher

**course-average-fetcher** is the tool we use to update course average seed
data from the crowdsourced McGill Enhanced Google Sheet. It fetches the sheet
through the Google Sheets API, converts the rows into `CourseAverage` objects,
and writes the JSON file used to seed the production database.

The source spreadsheet stores terms in short form, such as `F2024` or `W2025`.
This tool expands them to display terms, such as `Fall 2024` and
`Winter 2025`, and validates averages against the grade values supported by
the application.

## Usage

You can invoke `course-average-fetcher` from within this directory as follows:

```bash
cargo run
```

The `--output-path` flag specifies the JSON file to write (default: the
repository `seed/course-averages.json` file).

```bash
cargo run -- --output-path ../../seed/course-averages.json
```

The `--source-path` flag reads a local Google Sheets values JSON file instead
of fetching from Google. This is useful for testing the transformation without
performing OAuth or network requests.

```bash
cargo run -- --source-path source.json --output-path course-averages.json
```

## Authentication

Fetching from Google Sheets requires OAuth client credentials for the Google
Sheets API. Save the downloaded client secret as `credentials.json` in this
directory, or pass a different path with `--credentials-path`.

On the first authenticated run, the tool opens a browser for Google OAuth and
writes a token cache to `tokencache.json`. The `--token-path` flag specifies a
different cache file.

## Input

The fetcher reads the `ResultsSimple!A3:F` range from the McGill Enhanced
spreadsheet. Each row is interpreted as follows:

| Column | Description |
|--------|-------------|
| `B` | Course ID, such as `COMP202` |
| `C` | Term in short form, such as `F2024`, `W2025`, or `S2025` |
| `D` | Letter grade average |

Rows with missing cells, invalid term codes, or unsupported grade values fail
the run.

## Output

The output JSON is an array of course average objects written to
`seed/course-averages.json` by default:

| Field | Description |
|-------|-------------|
| `courseId` | Course identifier |
| `term` | Expanded term name |
| `average` | Letter grade average |
