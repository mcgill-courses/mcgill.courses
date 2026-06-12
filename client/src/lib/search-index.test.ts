import { Index } from 'flexsearch';
import { describe, expect, it, vi } from 'vitest';

import type { CourseData, SearchResults } from './search-index';
import { getRankedCourses, updateSearchResults } from './search-index';

const course = (
  _id: string,
  subject: string,
  code: string,
  title: string
): CourseData => ({
  _id,
  code,
  subject,
  terms: [],
  title,
});

const courses: CourseData[] = [
  course('MATH203', 'MATH', '203', 'Principles of Statistics 1'),
  course('MATH204', 'MATH', '204', 'Principles of Statistics 2'),
  course('MATH222', 'MATH', '222', 'Calculus 3'),
  course('CHEM367', 'CHEM', '367', 'Instrumental Analysis 1'),
  course('MATH242', 'MATH', '242', 'Analysis 1'),
  course('COMP505', 'COMP', '505', 'Advanced Computer Architecture'),
  course('COMP550', 'COMP', '550', 'Natural Language Processing'),
];

const createIndex = () => {
  const index = new Index({ tokenize: 'forward' });

  courses.forEach((course, i) => {
    index.add(
      i,
      `${course._id} ${course.subject} ${course.title} ${course.code}`
    );
  });

  return index;
};

const search = (query: string) =>
  getRankedCourses(query, courses, createIndex())[0]._id;

describe('getRankedCourses', () => {
  it('prioritizes exact subject and code matches', () => {
    expect(search('math 222')).toBe('MATH222');
  });

  it('prefers exact title matches over partial matches', () => {
    expect(search('analysis 1')).toBe('MATH242');
  });

  it('keeps exact course ids on top even when numeric tokens overlap', () => {
    expect(search('comp 550')).toBe('COMP550');
  });

  it('still prioritizes the primary course when searching by title prefix only', () => {
    expect(search('analysis')).toBe('MATH242');
  });

  it('handles mixed casing and punctuation in queries', () => {
    expect(search('Comp-550')).toBe('COMP550');
  });

  it('keeps numeric only queries anchored to the matching course code', () => {
    expect(search('222')).toBe('MATH222');
  });

  it('returns the earliest subject match when only the subject is provided', () => {
    expect(search('math')).toBe('MATH203');
  });
});

describe('updateSearchResults', () => {
  const instructors = ['foo', 'bar'];

  it('skips instructor search when instructor limit is zero', () => {
    const search = vi.fn(() => [0, 1]);
    const instructorsIndex = { search } as unknown as Index;
    const setResults = vi.fn((_results: SearchResults) => {});

    updateSearchResults(
      'foo',
      courses,
      instructors,
      createIndex(),
      instructorsIndex,
      setResults,
      {
        instructorLimit: 0,
      }
    );

    expect(search).not.toHaveBeenCalled();
    expect(setResults).toHaveBeenCalledWith(
      expect.objectContaining({
        instructors: [],
      })
    );
  });

  it('uses the default instructor limit', () => {
    const search = vi.fn(() => [1, 0]);
    const instructorsIndex = { search } as unknown as Index;
    const setResults = vi.fn((_results: SearchResults) => {});

    updateSearchResults(
      'foo',
      courses,
      instructors,
      createIndex(),
      instructorsIndex,
      setResults
    );

    expect(search).toHaveBeenCalledWith('foo', { limit: 4 });
    expect(setResults).toHaveBeenCalledWith(
      expect.objectContaining({
        instructors: ['bar', 'foo'],
      })
    );
  });
});
