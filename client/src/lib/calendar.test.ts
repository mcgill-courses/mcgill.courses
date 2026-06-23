import { describe, expect, it } from 'vitest';

import {
  buildIcsContent,
  getFirstOccurrenceForTermDay,
  getTermMeetingRecurrence,
} from './calendar';

const dateParts = (date: Date) => [
  date.getFullYear(),
  date.getMonth() + 1,
  date.getDate(),
  date.getDay(),
];

describe('calendar', () => {
  it('gets first term day occurrence', () => {
    const cases = [
      ['Fall 2026', '2', [2026, 9, 7, 1]],
      ['Winter 2027', '2', [2027, 1, 11, 1]],
      ['Summer 2026', '6', [2026, 5, 8, 5]],
    ] as const;

    cases.forEach(([term, day, expected]) => {
      const occurrence = getFirstOccurrenceForTermDay(term, day);

      expect(occurrence && dateParts(occurrence)).toEqual(expected);
    });
  });

  it('builds sorted weekly recurrence', () => {
    const recurrence = getTermMeetingRecurrence('Fall 2026', ['5', '3', '3']);

    expect(recurrence?.start && dateParts(recurrence.start)).toEqual([
      2026, 9, 8, 2,
    ]);
    expect(recurrence?.rrule).toBe(
      'FREQ=WEEKLY;INTERVAL=1;COUNT=26;BYDAY=TU,TH'
    );
  });

  it('ignores invalid recurrence input', () => {
    expect(getFirstOccurrenceForTermDay('foo', '2')).toBeNull();
    expect(getFirstOccurrenceForTermDay('Fall 2026', '9')).toBeNull();
    expect(getTermMeetingRecurrence('Fall 2026', ['9'])).toBeNull();
  });

  it('serializes recurrence rules', () => {
    const content = buildIcsContent({
      events: [
        {
          end: new Date(2026, 8, 7, 10),
          rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=13;BYDAY=MO',
          start: new Date(2026, 8, 7, 9),
          summary: 'foo',
          uid: 'foo@mcgill.courses',
        },
      ],
    });

    expect(content).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=13;BYDAY=MO');
  });
});
