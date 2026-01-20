import type { Course } from '../lib/types';
import { Instructor, Review, Schedule } from './types';

const TERM_ORDER = ['Winter', 'Summer', 'Fall'];

/**
 * Groups course instructors by their terms, but only for current terms.
 *
 * Creates empty arrays for current terms that have no instructors.
 *
 * @param {Course} course - The course object containing instructors and terms
 * @returns {Record<string, Instructor[]>} Object mapping terms to arrays of instructors
 */
export const groupCurrentCourseTermInstructors = (
  course: Course
): Record<string, Instructor[]> => {
  const currentTerms = getCurrentTerms();

  const currentInstructors = course.instructors.filter((i) =>
    currentTerms.includes(i.term)
  );

  const termGroups = groupBy(currentInstructors, (i: Instructor) => i.term);

  for (const term of course.terms) {
    if (term in termGroups || !currentTerms.includes(term)) continue;
    termGroups[term] = [];
  }

  return termGroups;
};

/**
 * Determines the current and next two academic terms based on the current date.
 *
 * - May-July: Returns [Summer current, Fall current, Winter next]
 * - August-December: Returns [Fall current, Winter next, Summer next]
 * - January-April: Returns [Fall previous, Winter current, Summer current]
 *
 * @returns {[string, string, string]} Array of three consecutive terms
 */
export const getCurrentTerms = (): [string, string, string] => {
  const now = new Date();

  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month >= 5 && month < 8) {
    return [`Summer ${year}`, `Fall ${year}`, `Winter ${year + 1}`];
  }

  if (month >= 8) {
    return [`Fall ${year}`, `Winter ${year + 1}`, `Summer ${year + 1}`];
  }

  return [`Fall ${year - 1}`, `Winter ${year}`, `Summer ${year}`];
};

/**
 * Determines the current academic term based on the current date.
 *
 * - May-July: Summer <year>
 * - August-December: Fall <year>
 * - January-April: Winter <year>
 *
 * @returns {string} The current term
 */
export const getCurrentTerm = (): string => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month >= 5 && month < 8) {
    return `Summer ${year}`;
  }

  if (month >= 8) {
    return `Fall ${year}`;
  }

  return `Winter ${year}`;
};

/**
 * Compares two academic terms for sorting.
 *
 * Terms are compared first by year, then by season according to TERM_ORDER.
 *
 * @param {string} a - First term string (e.g., "Fall 2023")
 * @param {string} b - Second term string (e.g., "Winter 2024")
 * @returns {number} Negative if a comes before b, positive if b comes before a, 0 if equal
 */
export const compareTerms = (a: string, b: string): number => {
  return a.split(' ')[1] === b.split(' ')[1]
    ? TERM_ORDER.indexOf(a.split(' ')[0]) - TERM_ORDER.indexOf(b.split(' ')[0])
    : parseInt(a.split(' ')[1], 10) - parseInt(b.split(' ')[1], 10);
};

/**
 * Sorts an array of academic terms chronologically.
 *
 * Uses compareTerms to determine order.
 *
 * @param {string[]} terms - Array of term strings to sort
 * @returns {string[]} Sorted array of terms
 */
export const sortTerms = (terms: string[]): string[] => {
  return terms.sort(compareTerms);
};

/**
 * Sorts course schedules by block type and number.
 *
 * Order priority: Lec > Lab > Seminar > Tut > Conf
 *
 * Within each type, sorts numerically by block number.
 *
 * @param {Schedule[]} schedules - Array of course schedules to sort
 * @returns {Schedule[]} Sorted array of schedules
 */
export const sortSchedulesByBlocks = (schedules: Schedule[]): Schedule[] => {
  const order = ['Lec', 'Lab', 'Seminar', 'Tut', 'Conf'];

  return schedules.sort((a, b) => {
    const aDisplay = a.blocks?.[0]?.display ?? '';
    const bDisplay = b.blocks?.[0]?.display ?? '';

    const aNum = parseInt(aDisplay.split(' ')[1], 10);
    const bNum = parseInt(bDisplay.split(' ')[1], 10);

    const aType = aDisplay.split(' ')[0];
    const bType = bDisplay.split(' ')[0];

    return aType === bType
      ? aNum - bNum
      : order.indexOf(aType) - order.indexOf(bType);
  });
};

/**
 * Converts a course ID to a URL-friendly parameter format.
 *
 * Example: "COMP202" -> "comp-202"
 *
 * @param {string} courseId - The course ID to convert
 * @returns {string} URL-friendly course ID
 */
export const courseIdToUrlParam = (courseId: string): string =>
  `${courseId.slice(0, 4)}-${courseId.slice(4)}`.toLowerCase();

/**
 * Capitalizes the first character of a string.
 *
 * @param {string} s - The string to capitalize
 * @returns {string} Capitalized string
 */
export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Ensures a string ends with a period.
 *
 * Adds a period if one is not already present.
 *
 * @param {string} s - The string to punctuate
 * @returns {string} String ending with a period
 */
export const punctuate = (s: string): string =>
  s.charAt(s.length - 1) === '.' ? s : s + '.';

/**
 * Removes a leading word ending with a colon, such as "Prerequisites:".
 *
 * @param {string} text - The text to strip
 * @returns {string} Text without the colon-prefixed first word
 */
export const stripColonPrefix = (text: string): string => {
  const parts = text.split(' ');

  if (parts[0] && parts[0].endsWith(':')) {
    return parts.slice(1).join(' ');
  }

  return text;
};

const COURSE_CODE_REGEX = /^(([A-Z0-9]){4} [0-9]{3}(D1|D2|N1|N2|J1|J2|J3)?)$/;

/**
 * Validates if a string matches the course code format.
 *
 * Valid format: 4 alphanumeric chars + space + 3 digits + optional suffix
 *
 * Suffixes: D1, D2, N1, N2, J1, J2, J3
 *
 * @param {string} s - The string to validate
 * @returns {boolean} True if string is a valid course code
 */
export const isValidCourseCode = (s: string): boolean =>
  COURSE_CODE_REGEX.test(s);

/**
 * Inserts a delimiter between the subject and number portions of a course code.
 *
 * Example: spliceCourseCode("COMP202", "-") -> "COMP-202"
 *
 * @param {string} courseCode - The course code to splice
 * @param {string} delimiter - The delimiter to insert
 * @returns {string} Course code with delimiter inserted
 */
export const spliceCourseCode = (
  courseCode: string,
  delimiter: string
): string => courseCode.slice(0, 4) + delimiter + courseCode.slice(4);

/**
 * Generates a stable DOM anchor identifier for a review.
 *
 * Uses the author ID, which is unique per course review, to produce repeatable anchors.
 *
 * @param {Pick<Review, 'courseId' | 'userId' | 'timestamp'>} review - Review metadata
 * @returns {string} Anchor-friendly identifier
 */
export const getReviewAnchorId = (
  review: Pick<Review, 'courseId' | 'userId' | 'timestamp'>
): string => `review-${review.userId}`;

/**
 * Rounds a number to 2 decimal places.
 *
 * @param {number} n - Number to round
 * @returns {number} Rounded number
 */
export const round2Decimals = (n: number): number => Math.round(n * 100) / 100;

/**
 * Performs a true modulo operation (different from JavaScript's % operator).
 *
 * Always returns a positive number, even when inputs are negative.
 *
 * @param {number} n - Dividend
 * @param {number} m - Divisor
 * @returns {number} Positive modulo result
 */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * Custom error class for date-related errors.
 *
 * @extends Error
 */
export class InvalidDateError extends Error {
  constructor(message = 'Invalid date provided') {
    super(message);
    this.name = 'InvalidDateError';
  }
}

/**
 * Converts a date to a human-readable "time ago" string.
 *
 * Handles various time units from seconds to years.
 *
 * Throws InvalidDateError for null, undefined, invalid formats, or future dates.
 *
 * @param {Date | string | number | null | undefined} date - Date to convert
 * @returns {string} Human-readable time difference (e.g., "2 hours ago")
 * @throws {InvalidDateError} If date is invalid, missing, or in the future
 */
export const timeSince = (
  date: Date | string | number | null | undefined
): string => {
  if (!date) {
    throw new InvalidDateError('No date provided');
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.valueOf())) {
    throw new InvalidDateError('Invalid date format');
  }

  if (dateObj.valueOf() > Date.now()) {
    throw new InvalidDateError('Future date is not allowed');
  }

  const seconds = Math.floor((Date.now() - dateObj.valueOf()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.floor(months / 12);

  return years === 1 ? '1 year ago' : `${years} years ago`;
};

/**
 * Groups array items by a key derived from each item.
 *
 * @param arr - Array to group
 * @param fn - Function that returns the grouping key for each item
 * @returns Object mapping keys to arrays of items
 */
export const groupBy = <T>(
  arr: T[],
  fn: (item: T) => string | undefined
): Record<string, T[]> =>
  arr.reduce(
    (acc, item) => {
      const key = fn(item) ?? '';
      (acc[key] ??= []).push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );

/**
 * Maps the values of an object using a transform function.
 *
 * @param obj - Object to transform
 * @param fn - Function to apply to each value
 * @returns New object with transformed values
 */
export const mapValues = <T, U>(
  obj: Record<string, T>,
  fn: (val: T) => U
): Record<string, U> =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)])) as Record<
    string,
    U
  >;

/**
 * Sorts an array by a key derived from each item.
 *
 * @param arr - Array to sort
 * @param fn - Function that returns the sort key for each item
 * @returns New sorted array
 */
export const sortBy = <T>(
  arr: T[],
  fn: (item: T) => string | number | undefined
): T[] =>
  [...arr].sort((a, b) => {
    const keyA = fn(a) ?? '';
    const keyB = fn(b) ?? '';
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });

/**
 * Returns unique values from an array.
 *
 * @param arr - Array with potential duplicates
 * @returns Array with duplicates removed
 */
export const uniq = <T>(arr: T[]): T[] => [...new Set(arr)];

/**
 * Returns unique values from an array based on a key function.
 *
 * @param arr - Array with potential duplicates
 * @param fn - Function that returns the uniqueness key for each item
 * @returns Array with duplicates removed
 */
export const uniqBy = <T>(arr: T[], fn: (item: T) => unknown): T[] => {
  const seen = new Set();

  return arr.filter((item) => {
    const key = fn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Escapes special regex characters in a string.
 *
 * @param s - String to escape
 * @returns String safe for use in RegExp constructor
 */
export const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Sums an array of numbers.
 *
 * @param arr - Array of numbers to sum
 * @returns Sum of all numbers
 */
export const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);
