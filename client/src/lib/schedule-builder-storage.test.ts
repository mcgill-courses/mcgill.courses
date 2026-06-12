import { beforeEach, describe, expect, test } from 'vitest';

import {
  readStoredSchedule,
  writeStoredSchedule,
} from './schedule-builder-storage';

const storageKey = 'mcgill.courses.schedule-builder';
const currentTerms = ['Fall 2026', 'Winter 2027', 'Summer 2027'];

const createStorage = (): Storage => {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear: () => {
      store = {};
    },
    getItem: (key) => store[key] ?? null,
    key: (index) => Object.keys(store)[index] ?? null,
    removeItem: (key) => {
      delete store[key];
    },
    setItem: (key, value) => {
      store[key] = value;
    },
  };
};

describe('schedule builder storage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createStorage(),
    });
  });

  test('stores schedules by term', () => {
    writeStoredSchedule({
      schedulesByTerm: {
        'Fall 2026': {
          allowConflicts: false,
          pinnedOptions: { foo: 'bar' },
          selectedCourseIds: ['foo'],
          selectedResultId: 'baz',
        },
        'Winter 2027': {
          allowConflicts: true,
          pinnedOptions: {},
          selectedCourseIds: ['bar'],
        },
      },
      selectedTerm: 'Winter 2027',
    });

    expect(readStoredSchedule(currentTerms)).toEqual({
      schedulesByTerm: {
        'Fall 2026': {
          allowConflicts: false,
          pinnedOptions: { foo: 'bar' },
          selectedCourseIds: ['foo'],
          selectedResultId: 'baz',
        },
        'Winter 2027': {
          allowConflicts: true,
          pinnedOptions: {},
          selectedCourseIds: ['bar'],
          selectedResultId: undefined,
        },
      },
      selectedTerm: 'Winter 2027',
    });
  });

  test('ignores old flat storage', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        allowConflicts: true,
        pinnedOptions: { foo: 'bar' },
        selectedCourseIds: ['foo'],
        selectedTerm: 'Fall 2026',
      })
    );

    expect(readStoredSchedule(currentTerms)).toBeUndefined();
  });
});
