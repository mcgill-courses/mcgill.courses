import json
from dataclasses import dataclass
from pathlib import Path

from arrg import app, argument

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Course:
  id: str
  title: str
  terms: list[str]


@app(description='Aggregate course data from seed files and export to JSON.')
class App:
  seed_path: str = argument(
    '-s',
    '--seed-path',
    default=str(REPO_ROOT / 'seed'),
    help='Path to the directory containing seed files.',
  )

  output_path: str = argument(
    '-o',
    '--output-path',
    default=str(REPO_ROOT / 'client/src/assets/search-data.json'),
    help='Path to the output JSON file.',
  )

  def run(self) -> None:
    seed_path = Path(self.seed_path)
    data_paths = []

    for file_path in sorted(seed_path.iterdir()):
      filename = file_path.name

      if (
        not file_path.is_file()
        or not filename.startswith('courses-')
        or not filename.endswith('.json')
      ):
        continue

      data_paths.append(file_path)

    unique_courses = {}
    unique_instructors = set()

    for file_path in data_paths:
      with open(file_path) as fobj:
        courses = json.load(fobj)

        for course in courses:
          unique_courses[course['_id']] = Course(
            course['_id'],
            course['title'],
            course.get('terms', []),
          )

          for instructor in course['instructors']:
            unique_instructors.add(instructor['name'])

    output = {
      'courses': [course.__dict__ for course in unique_courses.values()],
      'instructors': sorted(unique_instructors),
    }

    with open(self.output_path, 'w') as fobj:
      json.dump(output, fobj)

    print(f'Output written to {self.output_path}')


if __name__ == '__main__':
  App.from_args().run()
