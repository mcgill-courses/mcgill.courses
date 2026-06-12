import { describe, expect, test } from 'vitest';

import {
  buildScheduleResults,
  getBlockMeetingLabels,
  getCourseScheduleOptions,
  getScheduleConflicts,
} from './schedule-builder';
import type { Block, Course } from './types';

const term = 'Fall 2026';

const block = (
  display: string,
  day: string,
  t1: string,
  t2: string
): Block => ({
  campus: 'foo',
  crn: display,
  display,
  location: 'bar',
  timeblocks: [{ day, t1, t2 }],
});

const course = (id: string, blocks: Block[]): Course => ({
  _id: id,
  avgDifficulty: 0,
  avgRating: 0,
  code: id.slice(4),
  corequisites: [],
  credits: '3',
  department: 'foo',
  description: 'bar',
  faculty: 'foo',
  instructors: [],
  leadingTo: [],
  prerequisites: [],
  reviewCount: 0,
  schedule: blocks.map((block) => ({
    blocks: [block],
    term,
  })),
  subject: id.slice(0, 4),
  terms: [term],
  title: 'bar',
  url: 'foo',
});

const courseWithSchedules = (id: string, schedules: Block[][]): Course => ({
  ...course(id, []),
  schedule: schedules.map((blocks) => ({
    blocks,
    term,
  })),
});

describe('schedule builder', () => {
  test('builds non-conflicting schedules', () => {
    const foo = course('FOOO100', [
      block('Lec 001', '2', '540', '600'),
      block('Lec 002', '2', '660', '720'),
    ]);
    const bar = course('BARR200', [block('Lec 001', '2', '540', '600')]);

    const build = buildScheduleResults([foo, bar], term);

    expect(build.missingCourses).toEqual([]);
    expect(build.results).toHaveLength(1);
    expect(build.results[0].options.map((option) => option.label)).toEqual([
      'Lec 002',
      'Lec 001',
    ]);
  });

  test('builds schedules with pinned sections', () => {
    const foo = course('FOOO100', [
      block('Lec 001', '2', '540', '600'),
      block('Lec 002', '2', '660', '720'),
    ]);
    const bar = course('BARR200', [block('Lec 001', '3', '540', '600')]);
    const pinnedOption = getCourseScheduleOptions(foo, term)[1];

    const build = buildScheduleResults([foo, bar], term, {
      pinnedOptions: {
        [foo._id]: pinnedOption.id,
      },
    });

    expect(build.results).toHaveLength(1);
    expect(build.results[0].options.map((option) => option.id)).toContain(
      pinnedOption.id
    );
    expect(build.results[0].options.map((option) => option.label)).toEqual([
      'Lec 002',
      'Lec 001',
    ]);
  });

  test('ignores unavailable pinned sections', () => {
    const foo = course('FOOO100', [
      block('Lec 001', '2', '540', '600'),
      block('Lec 002', '2', '660', '720'),
    ]);

    const build = buildScheduleResults([foo], term, {
      pinnedOptions: {
        [foo._id]: 'foo',
      },
    });

    expect(build.results).toHaveLength(2);
  });

  test('builds schedules with conflicts when allowed', () => {
    const foo = course('FOOO100', [block('Lec 001', '2', '540', '600')]);
    const bar = course('BARR200', [block('Lec 001', '2', '540', '600')]);

    const build = buildScheduleResults([foo, bar], term, {
      allowConflicts: true,
    });

    expect(build.results).toHaveLength(1);
    expect(build.results[0].options.map((option) => option.label)).toEqual([
      'Lec 001',
      'Lec 001',
    ]);
  });

  test('reports courses without sections', () => {
    const foo = course('FOOO100', []);

    const build = buildScheduleResults([foo], term);

    expect(build.missingCourses).toEqual([foo]);
    expect(build.results).toEqual([]);
  });

  test('reports overlapping sections', () => {
    const foo = course('FOOO100', [block('Lec 001', '2', '540', '620')]);
    const bar = course('BARR200', [block('Lec 001', '2', '600', '660')]);

    expect(getScheduleConflicts([foo, bar], term)).toMatchObject([
      {
        day: '2',
        end: 620,
        left: { courseId: 'FOOO100' },
        right: { courseId: 'BARR200' },
        start: 600,
      },
    ]);
  });

  test('expands repeated leading blocks', () => {
    const lecture = block('Lec 001', '2', '540', '600');
    const foo = courseWithSchedules('FOOO100', [
      [
        lecture,
        block('Lab 002', '3', '540', '600'),
        lecture,
        block('Lab 003', '4', '540', '600'),
      ],
    ]);

    expect(
      getCourseScheduleOptions(foo, term).map((option) => option.label)
    ).toEqual(['Lec 001 + Lab 002', 'Lec 001 + Lab 003']);
  });

  test('expands repeated trailing blocks', () => {
    const seminar = block('Seminar 003', '6', '695', '745');
    const foo = courseWithSchedules('FOOO100', [
      [
        block('Lec 001', '5', '635', '745'),
        seminar,
        block('Lec 002', '5', '635', '745'),
        seminar,
      ],
    ]);

    expect(
      getCourseScheduleOptions(foo, term).map((option) => option.label)
    ).toEqual(['Lec 001 + Seminar 003', 'Lec 002 + Seminar 003']);
  });

  test('keeps same-time alternate sections', () => {
    const foo = courseWithSchedules('FOOO100', [
      [
        block('Lec 001', '2', '875', '1045'),
        block('Lec 002', '2', '875', '1045'),
      ],
    ]);

    expect(
      getCourseScheduleOptions(foo, term).map((option) => option.label)
    ).toEqual(['Lec 001', 'Lec 002']);
  });

  test('keeps blocks with duplicate timeblocks', () => {
    const foo = courseWithSchedules('FOOO100', [
      [
        {
          ...block('Lec 001', '2', '785', '955'),
          timeblocks: [
            { day: '2', t1: '785', t2: '955' },
            { day: '2', t1: '785', t2: '955' },
          ],
        },
      ],
    ]);

    const options = getCourseScheduleOptions(foo, term);

    expect(options).toHaveLength(1);
    expect(options[0].blocks[0].timeblocks).toEqual([
      { day: '2', t1: '785', t2: '955' },
    ]);
  });

  test('uses stable section ids', () => {
    const first = block('Lec 001', '2', '540', '600');
    const second = block('Lec 002', '3', '540', '600');
    const original = courseWithSchedules('FOOO100', [[first], [second]]);
    const reordered = courseWithSchedules('FOOO100', [[second], [first]]);

    const originalId = getCourseScheduleOptions(original, term).find(
      (option) => option.label === 'Lec 001'
    )?.id;
    const reorderedId = getCourseScheduleOptions(reordered, term).find(
      (option) => option.label === 'Lec 001'
    )?.id;

    expect(reorderedId).toBe(originalId);
  });

  test('formats meeting labels', () => {
    const foo = course('FOOO100', [block('Lec 001', '2', '540', '600')]);
    const option = getCourseScheduleOptions(foo, term)[0];

    expect(getBlockMeetingLabels(option.blocks[0])).toEqual([
      'Mon · 9 AM - 10 AM',
    ]);
  });
});
