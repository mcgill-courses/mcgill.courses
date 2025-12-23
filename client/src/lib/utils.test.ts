import { vi } from 'vitest';

import type { Course } from '../model/course';
import type { Schedule } from './types';
import {
  InvalidDateError,
  capitalize,
  compareTerms,
  courseIdToUrlParam,
  getCurrentTerms,
  groupCurrentCourseTermInstructors,
  isValidCourseCode,
  mod,
  punctuate,
  round2Decimals,
  sortSchedulesByBlocks,
  sortTerms,
  spliceCourseCode,
  stripColonPrefix,
  timeSince,
} from './utils';

describe('timeSince', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles string timestamps', () => {
    expect(timeSince('2023-12-31T23:00:00Z')).toBe('1 hour ago');
  });

  it('handles numeric timestamps', () => {
    const timestamp = new Date('2023-12-31T23:00:00Z').valueOf();
    expect(timeSince(timestamp)).toBe('1 hour ago');
  });

  it('handles Date objects', () => {
    const date = new Date('2023-12-31T23:00:00Z');
    expect(timeSince(date)).toBe('1 hour ago');
  });

  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    const date = new Date('2023-12-31T23:59:30Z'); // 30 seconds ago
    expect(timeSince(date)).toBe('just now');
  });

  it('returns "just now" for timestamps exactly 0 seconds ago', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    expect(timeSince(date)).toBe('just now');
  });

  it('returns "1 minute ago" for timestamps exactly 1 minute ago', () => {
    const date = new Date('2023-12-31T23:59:00Z');
    expect(timeSince(date)).toBe('1 minute ago');
  });

  it('returns "X minutes ago" for timestamps less than an hour ago', () => {
    const date = new Date('2023-12-31T23:30:00Z'); // 30 minutes ago
    expect(timeSince(date)).toBe('30 minutes ago');
  });

  it('returns "1 hour ago" for timestamps exactly 1 hour ago', () => {
    const date = new Date('2023-12-31T23:00:00Z');
    expect(timeSince(date)).toBe('1 hour ago');
  });

  it('returns "X hours ago" for timestamps less than a day ago', () => {
    const date = new Date('2023-12-31T12:00:00Z'); // 12 hours ago
    expect(timeSince(date)).toBe('12 hours ago');
  });

  it('returns "1 day ago" for timestamps exactly 1 day ago', () => {
    const date = new Date('2023-12-31T00:00:00Z');
    expect(timeSince(date)).toBe('1 day ago');
  });

  it('returns "X days ago" for timestamps less than a week ago', () => {
    const date = new Date('2023-12-28T00:00:00Z'); // 4 days ago
    expect(timeSince(date)).toBe('4 days ago');
  });

  it('returns "1 week ago" for timestamps exactly 1 week ago', () => {
    const date = new Date('2023-12-25T00:00:00Z');
    expect(timeSince(date)).toBe('1 week ago');
  });

  it('returns "X weeks ago" for timestamps less than a month ago', () => {
    const date = new Date('2023-12-11T00:00:00Z'); // ~3 weeks ago
    expect(timeSince(date)).toBe('3 weeks ago');
  });

  it('returns "1 month ago" for timestamps exactly 1 month ago', () => {
    const date = new Date('2023-12-01T00:00:00Z');
    expect(timeSince(date)).toBe('1 month ago');
  });

  it('returns "X months ago" for timestamps less than a year ago', () => {
    const date = new Date('2023-09-01T00:00:00Z'); // 4 months ago
    expect(timeSince(date)).toBe('4 months ago');
  });

  it('returns "1 year ago" for timestamps exactly 1 year ago', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    expect(timeSince(date)).toBe('1 year ago');
  });

  it('returns "X years ago" for timestamps more than a year ago', () => {
    const date = new Date('2021-01-01T00:00:00Z'); // 3 years ago
    expect(timeSince(date)).toBe('3 years ago');
  });

  it('handles exact boundary transitions', () => {
    expect(timeSince(new Date('2023-12-31T23:59:01Z'))).toBe('just now');
    expect(timeSince(new Date('2023-12-31T23:59:00Z'))).toBe('1 minute ago');
    expect(timeSince(new Date('2023-12-31T23:00:00Z'))).toBe('1 hour ago');
    expect(timeSince(new Date('2023-12-31T01:00:00Z'))).toBe('23 hours ago');
    expect(timeSince(new Date('2023-12-26T00:00:00Z'))).toBe('6 days ago');
    expect(timeSince(new Date('2023-12-04T00:00:00Z'))).toBe('4 weeks ago');
    expect(timeSince(new Date('2023-02-01T00:00:00Z'))).toBe('11 months ago');
  });

  it('handles dates in different timezones', () => {
    const date = new Date('2023-12-31T23:00:00+04:00');
    expect(timeSince(date)).toBe('5 hours ago');
  });

  it('throws InvalidDateError with specific messages', () => {
    expect(() => timeSince(null)).toThrow(
      new InvalidDateError('No date provided')
    );
    expect(() => timeSince(undefined)).toThrow(
      new InvalidDateError('No date provided')
    );
    expect(() => timeSince('invalid-date')).toThrow(
      new InvalidDateError('Invalid date format')
    );
    expect(() => timeSince(new Date('invalid'))).toThrow(
      new InvalidDateError('Invalid date format')
    );
    expect(() => timeSince(new Date('2100-01-01'))).toThrow(
      new InvalidDateError('Future date is not allowed')
    );
  });
});

describe('getCurrentTerms', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns summer-fall-winter for May-July', () => {
    vi.setSystemTime(new Date('2024-06-15'));

    expect(getCurrentTerms()).toEqual([
      'Summer 2024',
      'Fall 2024',
      'Winter 2025',
    ]);
  });

  it('returns fall-winter-summer for August-December', () => {
    vi.setSystemTime(new Date('2024-09-15'));

    expect(getCurrentTerms()).toEqual([
      'Fall 2024',
      'Winter 2025',
      'Summer 2025',
    ]);
  });

  it('returns fall-winter-summer for January-April', () => {
    vi.setSystemTime(new Date('2024-03-15'));

    expect(getCurrentTerms()).toEqual([
      'Fall 2023',
      'Winter 2024',
      'Summer 2024',
    ]);
  });

  it('handles edge case dates', () => {
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));

    expect(getCurrentTerms()).toEqual([
      'Summer 2024',
      'Fall 2024',
      'Winter 2025',
    ]);

    vi.setSystemTime(new Date('2024-08-01T12:00:00Z'));

    expect(getCurrentTerms()).toEqual([
      'Fall 2024',
      'Winter 2025',
      'Summer 2025',
    ]);

    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    expect(getCurrentTerms()).toEqual([
      'Fall 2023',
      'Winter 2024',
      'Summer 2024',
    ]);
  });
});

describe('compareTerms', () => {
  it('compares terms in same year', () => {
    expect(compareTerms('Winter 2024', 'Summer 2024')).toBeLessThan(0);
    expect(compareTerms('Summer 2024', 'Fall 2024')).toBeLessThan(0);
    expect(compareTerms('Fall 2024', 'Winter 2024')).toBeGreaterThan(0);
  });

  it('compares terms across different years', () => {
    expect(compareTerms('Fall 2023', 'Winter 2024')).toBeLessThan(0);
    expect(compareTerms('Winter 2025', 'Fall 2024')).toBeGreaterThan(0);
  });

  it('handles equal terms', () => {
    expect(compareTerms('Fall 2024', 'Fall 2024')).toBe(0);
  });
});

describe('sortTerms', () => {
  it('sorts terms chronologically', () => {
    const terms = [
      'Fall 2024',
      'Winter 2024',
      'Summer 2025',
      'Winter 2025',
      'Summer 2024',
    ];

    const expected = [
      'Winter 2024',
      'Summer 2024',
      'Fall 2024',
      'Winter 2025',
      'Summer 2025',
    ];

    expect(sortTerms(terms)).toEqual(expected);
  });

  it('handles empty array', () => {
    expect(sortTerms([])).toEqual([]);
  });

  it('handles single term', () => {
    expect(sortTerms(['Fall 2024'])).toEqual(['Fall 2024']);
  });
});

describe('sortSchedulesByBlocks', () => {
  it('sorts blocks by type and number', () => {
    const schedules = [
      { blocks: [{ display: 'Tut 2' }] },
      { blocks: [{ display: 'Lec 1' }] },
      { blocks: [{ display: 'Lab 1' }] },
      { blocks: [{ display: 'Lec 2' }] },
      { blocks: [{ display: 'Seminar 1' }] },
    ] as Schedule[];

    const sorted = sortSchedulesByBlocks(schedules);

    expect(sorted.map((s) => s.blocks?.[0]?.display)).toEqual([
      'Lec 1',
      'Lec 2',
      'Lab 1',
      'Seminar 1',
      'Tut 2',
    ]);
  });

  it('handles same type with different numbers', () => {
    const schedules = [
      { blocks: [{ display: 'Lec 2' }] },
      { blocks: [{ display: 'Lec 1' }] },
    ] as Schedule[];

    const sorted = sortSchedulesByBlocks(schedules);

    expect(sorted.map((s) => s.blocks?.[0]?.display)).toEqual([
      'Lec 1',
      'Lec 2',
    ]);
  });
});

describe('courseIdToUrlParam', () => {
  it('converts course ID to URL parameter format', () => {
    expect(courseIdToUrlParam('COMP202')).toBe('comp-202');
    expect(courseIdToUrlParam('MATH133')).toBe('math-133');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('world')).toBe('World');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('handles already capitalized string', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });
});

describe('punctuate', () => {
  it('adds period if missing', () => {
    expect(punctuate('hello')).toBe('hello.');
    expect(punctuate('world')).toBe('world.');
  });

  it('does not add period if already present', () => {
    expect(punctuate('hello.')).toBe('hello.');
  });

  it('handles empty string', () => {
    expect(punctuate('')).toBe('.');
  });
});

describe('stripColonPrefix', () => {
  it('removes leading colon-prefixed word', () => {
    expect(stripColonPrefix('Prerequisites: MATH 203')).toBe('MATH 203');
  });

  it('returns original text when no colon suffix on first word', () => {
    expect(stripColonPrefix('Prerequisites are required')).toBe(
      'Prerequisites are required'
    );
  });

  it('leaves strings without leading words intact', () => {
    expect(stripColonPrefix('MATH 203 Prerequisites: None')).toBe(
      'MATH 203 Prerequisites: None'
    );
  });
});

describe('isValidCourseCode', () => {
  it('validates correct course codes', () => {
    expect(isValidCourseCode('COMP 202')).toBe(true);
    expect(isValidCourseCode('MATH 133')).toBe(true);
    expect(isValidCourseCode('COMP 202D1')).toBe(true);
    expect(isValidCourseCode('MATH 133N2')).toBe(true);
  });

  it('rejects invalid course codes', () => {
    expect(isValidCourseCode('COMP202')).toBe(false); // missing space
    expect(isValidCourseCode('COM 202')).toBe(false); // wrong length
    expect(isValidCourseCode('COMP 2O2')).toBe(false); // letter in number
    expect(isValidCourseCode('COMP 202D3')).toBe(false); // invalid suffix
  });
});

describe('spliceCourseCode', () => {
  it('splices course code with delimiter', () => {
    expect(spliceCourseCode('COMP202', '-')).toBe('COMP-202');
    expect(spliceCourseCode('MATH133', '_')).toBe('MATH_133');
  });
});

describe('round2Decimals', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2Decimals(3.14159)).toBe(3.14);
    expect(round2Decimals(2.005)).toBe(2.01);
    expect(round2Decimals(2)).toBe(2);
  });
});

describe('mod', () => {
  it('calculates true modulo for positive numbers', () => {
    expect(mod(5, 3)).toBe(2);
    expect(mod(7, 4)).toBe(3);
  });

  it('calculates true modulo for negative numbers', () => {
    expect(mod(-5, 3)).toBe(1);
    expect(mod(-7, 4)).toBe(1);
  });

  it('handles zero dividend', () => {
    expect(mod(0, 5)).toBe(0);
  });
});

describe('groupCurrentCourseTermInstructors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups instructors by current terms', () => {
    const course = {
      terms: ['Fall 2023', 'Winter 2024', 'Summer 2024'],
      instructors: [
        { term: 'Fall 2023', name: 'Prof A' },
        { term: 'Winter 2024', name: 'Prof B' },
        { term: 'Summer 2024', name: 'Prof C' },
        { term: 'Fall 2022', name: 'Prof D' },
      ],
    } as Course;

    const result = groupCurrentCourseTermInstructors(course);

    expect(result).toEqual({
      'Fall 2023': [{ term: 'Fall 2023', name: 'Prof A' }],
      'Winter 2024': [{ term: 'Winter 2024', name: 'Prof B' }],
      'Summer 2024': [{ term: 'Summer 2024', name: 'Prof C' }],
    });
  });

  it('includes empty arrays for terms without instructors', () => {
    const course = {
      terms: ['Fall 2023', 'Winter 2024', 'Summer 2024'],
      instructors: [{ term: 'Fall 2023', name: 'Prof A' }],
    } as Course;

    const result = groupCurrentCourseTermInstructors(course);

    expect(result).toEqual({
      'Fall 2023': [{ term: 'Fall 2023', name: 'Prof A' }],
      'Winter 2024': [],
      'Summer 2024': [],
    });
  });
});
