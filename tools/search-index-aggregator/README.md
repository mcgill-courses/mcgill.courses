## search-index-aggregator

**search-index-aggregator** is the tool we use to build the compact
client-side search data consumed by [mcgill.courses](https://mcgill.courses/).
It reads scraped course seed files and writes the smaller JSON payload imported
by the frontend search index.

The source data lives in course [seed files](https://github.com/mcgill-courses/mcgill.courses/tree/master/seed),
which contain the full course objects used to initialize the production
database. Those files include significantly more data than the search bar and
schedule builder need.

This tool keeps only each course's ID, title, terms, and unique instructor
names, then writes them to
[`client/src/assets/search-data.json`](https://github.com/mcgill-courses/mcgill.courses/blob/master/client/src/assets/search-data.json).

## Usage

You can invoke `search-index-aggregator` from within this directory as follows:

```bash
cargo run
```

The `--seed-path` flag specifies the directory containing seed files (default:
the repository `seed` directory). The `--output-path` flag specifies the JSON
file to write (default: the repository
`client/src/assets/search-data.json` file).

```bash
cargo run -- --seed-path ../../seed --output-path ../../client/src/assets/search-data.json
```

## Input

The aggregator reads files named `courses-*.json` from `--seed-path`, sorted by
file name. Files with other names are ignored.

When the same course ID appears in multiple seed files, the later seed file
replaces the course title and terms while preserving the course's first-seen
position in the output list. Instructor names are collected across all course
seed files.

## Output

The output JSON contains two top-level arrays:

| Field | Description |
|-------|-------------|
| `courses` | Course objects with `id`, `title`, and `terms` fields |
| `instructors` | Sorted unique instructor names |
