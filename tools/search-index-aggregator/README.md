The search functionality in [mcgill.courses](https://mcgill.courses/) implements client-side indexing of course data,
extracting course and instructor keywords for optimized search performance.

Our system utilizes a [JSON seed file](https://github.com/terror/mcgill.courses/tree/master/seed) containing scraped course data for database initialization,
which we repurpose for the search indexing process.

To address performance concerns, the raw data files are substantial and would consume
excessive resources when bundled for client-side delivery.

**search-index-aggregator** selectively includes only the [JSON fields](https://github.com/terror/mcgill.courses/blob/master/client/src/assets/search-data.json) required by the
search component and schedule builder, significantly reducing payload size and improving resource efficiency.

### Setup

First, install dependencies:

```bash
uv sync
```

### Usage

Run this tool from this directory directly:

```shell
uv run main.py
```

...or you can specify options:

```present uv run main.py --help
usage: main.py [-h] [-s SEED_PATH] [-o OUTPUT_PATH]

Aggregate course data from seed files and export to JSON.

options:
  -h, --help            show this help message and exit
  -s SEED_PATH, --seed-path SEED_PATH
                        Path to the directory containing seed files.
  -o OUTPUT_PATH, --output-path OUTPUT_PATH
                        Path to the output JSON file.
```
