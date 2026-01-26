## scraper

**scraper** is the tool we use for fetching up-to-date course information from
various websites offered by McGill University. We primarily use this tool to
update course [seed files](https://github.com/mcgill-courses/mcgill.courses/tree/master/seed), which is course information data that makes it into our production database.

## Usage

To use `scraper`, you can invoke it from this directory, i.e.

```bash
cargo run -- \
  --batch-size=5 \
  --course-delay 1000 \
  --source seed \
  --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36" \
```

Below contains concrete usage information:

```
Usage: mcgill-courses-scraper [OPTIONS] --user-agent <USER_AGENT>

Options:
      --batch-size <BATCH_SIZE>      Number of pages to scrape per concurrent batch [default: 20]
      --course-delay <COURSE_DELAY>  Time delay between course requests in milliseconds [default: 0]
      --mcgill-terms <MCGILL_TERMS>  The mcgill terms to scrape [default: 2025-2026]
      --retries <RETRIES>            Number of retries [default: 10]
      --scrape-vsb                   Scrape visual schedule builder information
      --source <SOURCE>              [default: courses.json]
      --user-agent <USER_AGENT>      A user agent
      --vsb-terms <VSB_TERMS>        The schedule builder terms to scrape [default: 202505 202509 202601]
  -h, --help                         Print help
```
