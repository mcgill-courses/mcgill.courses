**changelog-generator** is a tool that outputs monthly-scoped AI generated summaries for
pull requests present in a GitHub repository.

We use it to populate changelog entries in `client/src/assets/changelog.json`
for display on our [changelog page](https://mcgill.courses/changelog).

### Usage

From the root directory:

```bash
cargo run --manifest-path tools/changelog-generator/Cargo.toml \
  -- \
  --output client/src/assets/changelog.json \
  {{args}}
```

n.b. The tool assumes you have a `OPENAI_API_KEY` set in the environment, as it
uses the `gpt-5.1-nano` model to generate changelogs.

For full usage information, see the output below:

```present cargo run -- --help
Usage: changelog-generator [OPTIONS]

Options:
      --output <OUTPUT>               [default: ../../client/src/assets/changelog.json]
      --regenerate [<REGENERATE>...]
      --regenerate-all
      --repo <REPO>                   [default: mcgill.courses]
      --user <USER>                   [default: terror]
  -h, --help                          Print help
```
