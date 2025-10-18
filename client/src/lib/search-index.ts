import { Index } from 'flexsearch';

import data from '../assets/search-data.json';
import { Course } from '../model/course';
import type { SearchResults } from '../model/search-results';

let coursesIndex: Index | null = null;
let instructorsIndex: Index | null = null;

export type CourseData = Pick<
  Course,
  '_id' | 'subject' | 'title' | 'code' | 'instructors'
>;

export type InstructorName = string;

export const getSearchIndex = () => {
  const courses = data.courses as CourseData[];
  const instructors = data.instructors as InstructorName[];

  if (coursesIndex === null) {
    coursesIndex = new Index({
      tokenize: 'forward',
    });

    courses.forEach((course, i) =>
      coursesIndex?.add(
        i,
        `${course._id} ${course.subject} ${course.title} ${course.code}`
      )
    );
  }

  if (instructorsIndex === null) {
    instructorsIndex = new Index({
      tokenize: 'forward',
    });

    instructors.forEach((instructorName, i) =>
      instructorsIndex?.add(i, instructorName)
    );
  }

  return { courses, instructors, coursesIndex, instructorsIndex };
};

export const updateSearchResults = (
  query: string,
  courses: CourseData[],
  instructors: InstructorName[],
  coursesIndex: Index,
  instructorsIndex: Index,
  setResults: (_: SearchResults) => void
) => {
  const courseSearchResults = getRankedCourses(
    query,
    courses,
    coursesIndex
  ).slice(0, 4);

  const instructorSearchResults = instructorsIndex
    .search(query, { limit: 4 })
    ?.map((id) => instructors[id as number]);

  setResults({
    query: query,
    courses: courseSearchResults,
    instructors: instructorSearchResults,
  });
};

const normalize = (value: string) => value.toLowerCase();

const compact = (value: string) => normalize(value).replace(/[^a-z0-9]/g, '');

const scoreCourseMatch = (query: string, course: CourseData) => {
  const normalizedQuery = normalize(query);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const queryCompact = compact(query);
  const subject = normalize(course.subject);
  const code = normalize(course.code);
  const id = normalize(course._id);
  const title = normalize(course.title);

  if (queryCompact.length === 0) {
    return 0;
  }

  let score = 0;

  if (id === queryCompact) {
    score += 1_000;
  }

  if (`${subject}${code}` === queryCompact) {
    score += 900;
  }

  const wordTokens = tokens.filter((token) => /[a-z]/.test(token));
  const numberTokens = tokens.filter((token) => /\d/.test(token));

  if (title === normalizedQuery) {
    score += 800;
  } else if (title.startsWith(normalizedQuery)) {
    score += 400;
  } else if (normalizedQuery.length >= 3 && title.includes(normalizedQuery)) {
    score += 200;
  }

  if (wordTokens.some((token) => subject === token)) {
    score += 500;
  }

  if (numberTokens.some((token) => code === token)) {
    score += 500;
  }

  if (wordTokens.some((token) => subject.startsWith(token))) {
    score += 100;
  }

  if (
    numberTokens.some((token) => token.length >= 2 && code.startsWith(token))
  ) {
    score += 80;
  }

  const titleMatches = tokens.reduce((matches, token) => {
    return matches + (title.includes(token) ? 1 : 0);
  }, 0);

  score += titleMatches * 10;

  return score;
};

export const getRankedCourses = (
  query: string,
  courses: CourseData[],
  index: Index
) => {
  const ids = index.search(query, { limit: 25 }) ?? [];
  const uniqueIds = Array.from(new Set(ids));

  return uniqueIds
    .map((id) => courses[id as number])
    .filter((course): course is CourseData => course !== undefined)
    .map((course) => ({
      course,
      score: scoreCourseMatch(query, course),
    }))
    .sort((a, b) => {
      if (b.score === a.score) {
        return a.course._id.localeCompare(b.course._id);
      }

      return b.score - a.score;
    })
    .map(({ course }) => course);
};
