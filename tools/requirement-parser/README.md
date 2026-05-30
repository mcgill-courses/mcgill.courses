## requirement-parser

**requirement-parser** is a tool to generate JSON-based course graph structures for
course entries used within the application.

<div align='center'>
  <img style='border-radius: 8px' width='500' src='https://github.com/terror/mcgill.courses/assets/31192478/de8f3f42-d3f5-4eac-9137-f9793bc877a3'/>
</div>

<br/>

We fine-tune a large language model on labeled examples to achieve high
accuracy with our output.

## Setup

First, install dependencies:

```bash
uv sync
```

Refer to `.env.example` for what environment variables need to be set.

## Usage

It's a single python script you can run, passing in a file on disk:

```bash
uv run main.py ../../seed/courses-2024-2025.json
```

It will run and populate a few fields on pre-existing course entries with the
generated graph structure.

For full usage information, see the output below:

```present uv run main.py --help
usage: main.py [-h] [-d DELAY] [-o] file

Parse logical course requirements from existing data.

positional arguments:
  file                  The path to the course JSON file.

options:
  -h, --help            show this help message and exit
  -d DELAY, --delay DELAY
                        The delay between requests in milliseconds.
  -o, --overwrite       Reparse all courses, even if they already have parsed
                        requirements.
```

## Prior Art

See [llmbda](https://github.com/SamZhang02/llmbda), a large language model based
propositional logic deduction assistant, for more context on the problem.
