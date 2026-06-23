import { parseVsbMinutes } from './schedule-builder';
import type { TimeBlock } from './types';
import { courseIdToUrlParam, spliceCourseCode } from './utils';

const ICS_TIMEZONE = 'America/Toronto';

const DEFAULT_TERM_MEETING_COUNT = 13;

const DAY_CODE_MAP: Record<string, string> = {
  '1': 'SU',
  '2': 'MO',
  '3': 'TU',
  '4': 'WE',
  '5': 'TH',
  '6': 'FR',
  '7': 'SA',
};

const DAY_ORDER = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const TERM_START_CONFIG = {
  Winter: { startMonth: 1, offsetDays: 6 },
  Summer: { startMonth: 5, offsetDays: 6 },
  Fall: { startMonth: 9, offsetDays: 6 },
} as const;

type TermSeason = keyof typeof TERM_START_CONFIG;

const padNumber = (value: number) => value.toString().padStart(2, '0');

const parseTermSeason = (
  term: string
): { season: TermSeason; year: number } | null => {
  const match = term.match(/^(Winter|Summer|Fall)\s+(\d{4})$/);

  if (!match) return null;

  const [, season, year] = match;

  return { season: season as TermSeason, year: parseInt(year, 10) };
};

const vsbDayToJsDay = (day: string): number | null => {
  const parsed = parseInt(day, 10);

  if (Number.isNaN(parsed)) return null;

  const jsDay = parsed - 1;

  return jsDay >= 0 && jsDay <= 6 ? jsDay : null;
};

export const getFirstOccurrenceForTermDay = (
  term: string,
  day: string
): Date | null => {
  const termInfo = parseTermSeason(term);
  const jsDay = vsbDayToJsDay(day);

  if (!termInfo || jsDay === null) return null;

  const { season, year } = termInfo;
  const { startMonth, offsetDays } = TERM_START_CONFIG[season];

  const anchor = new Date(year, startMonth - 1, 1);
  anchor.setDate(anchor.getDate() + offsetDays);

  const occurrence = new Date(anchor);
  const diff = (jsDay - occurrence.getDay() + 7) % 7;
  occurrence.setDate(occurrence.getDate() + diff);

  return occurrence;
};

const sortedVsbDays = (days: string[]) =>
  Array.from(new Set(days)).sort((left, right) => {
    return parseInt(left, 10) - parseInt(right, 10);
  });

const getByDayCodes = (days: string[]) =>
  sortedVsbDays(days)
    .map((day) => DAY_CODE_MAP[day])
    .filter((code): code is string => Boolean(code))
    .sort((left, right) => DAY_ORDER.indexOf(left) - DAY_ORDER.indexOf(right));

export const getTermMeetingRecurrence = (term: string, days: string[]) => {
  const byDayCodes = getByDayCodes(days);
  const firstDay = sortedVsbDays(days).find((day) => DAY_CODE_MAP[day]);
  const start = firstDay ? getFirstOccurrenceForTermDay(term, firstDay) : null;

  if (!start || byDayCodes.length === 0) return null;

  return {
    rrule: [
      'FREQ=WEEKLY',
      'INTERVAL=1',
      `COUNT=${DEFAULT_TERM_MEETING_COUNT * byDayCodes.length}`,
      `BYDAY=${byDayCodes.join(',')}`,
    ].join(';'),
    start,
  };
};

const formatIcsDateTime = (date: Date) =>
  [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
    'T',
    padNumber(date.getHours()),
    padNumber(date.getMinutes()),
    padNumber(date.getSeconds()),
  ].join('');

const formatIcsDateTimeUTC = (date: Date) =>
  [
    date.getUTCFullYear(),
    padNumber(date.getUTCMonth() + 1),
    padNumber(date.getUTCDate()),
    'T',
    padNumber(date.getUTCHours()),
    padNumber(date.getUTCMinutes()),
    padNumber(date.getUTCSeconds()),
    'Z',
  ].join('');

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

export type IcsEventOptions = {
  start: Date;
  end?: Date | null;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  uid: string;
  rrule?: string;
};

type ScheduleCalendarTimeBlock = TimeBlock & {
  days?: string[];
};

export type ScheduleCalendarBlock = {
  campus?: string | null;
  courseId: string;
  courseTitle: string;
  crn?: string | null;
  display?: string | null;
  location?: string | null;
  timeblocks: ScheduleCalendarTimeBlock[];
};

type BuildScheduleCalendarEventsOptions = {
  origin?: string;
};

type BuildIcsContentOptions = {
  events: IcsEventOptions[];
  prodId?: string;
};

const getCourseUrl = (courseId: string, origin: string) =>
  `${origin}/course/${courseIdToUrlParam(courseId)}`;

const getTimeblockDays = (timeblock: ScheduleCalendarTimeBlock) =>
  timeblock.days ?? (timeblock.day ? [timeblock.day] : []);

const groupScheduleTimeblocks = (timeblocks: ScheduleCalendarTimeBlock[]) =>
  timeblocks.reduce<
    Map<string, { days: string[]; end: number; start: number }>
  >((map, timeblock) => {
    const start = parseVsbMinutes(timeblock.t1);
    const end = parseVsbMinutes(timeblock.t2);
    const days = getTimeblockDays(timeblock);

    if (days.length === 0 || start === null || end === null) return map;

    const key = `${start}-${end}`;
    const value = map.get(key) ?? { days: [], end, start };
    map.set(key, { ...value, days: [...value.days, ...days] });

    return map;
  }, new Map());

export const buildScheduleCalendarEvents = (
  blocks: ScheduleCalendarBlock[],
  term: string,
  options: BuildScheduleCalendarEventsOptions = {}
): IcsEventOptions[] => {
  const origin = options.origin ?? 'https://mcgill.courses';

  return blocks.flatMap((block) =>
    Array.from(groupScheduleTimeblocks(block.timeblocks).values()).flatMap(
      ({ days, end, start }, index) => {
        const recurrence = getTermMeetingRecurrence(term, days);

        if (!recurrence) return [];

        const eventStart = new Date(recurrence.start);
        eventStart.setHours(Math.floor(start / 60), start % 60, 0, 0);

        const eventEnd = new Date(recurrence.start);
        eventEnd.setHours(Math.floor(end / 60), end % 60, 0, 0);

        const courseCode = spliceCourseCode(block.courseId, ' ');
        const uidBase = sanitizeForFilename(
          `${block.courseId}-${block.display ?? ''}-${block.crn ?? ''}-${term}-${start}-${end}-${index}`
        );

        return [
          {
            description: [
              block.courseTitle,
              block.display ? `Section: ${block.display}` : null,
              block.crn ? `CRN: ${block.crn}` : null,
              `Term: ${term}`,
              block.campus ? `Campus: ${block.campus}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
            end: eventEnd,
            location: block.location || block.campus || null,
            rrule: recurrence.rrule,
            start: eventStart,
            summary: `${courseCode} ${block.display ?? ''}`.trim(),
            uid: `${(uidBase || 'schedule').slice(0, 64)}@mcgill.courses`,
            url: getCourseUrl(block.courseId, origin),
          },
        ];
      }
    )
  );
};

export const buildIcsContent = ({
  events,
  prodId = '-//mcgill.courses//Calendar//EN',
}: BuildIcsContentOptions) => {
  if (!events.length) {
    throw new Error('buildIcsContent requires at least one event.');
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${formatIcsDateTimeUTC(new Date())}`);
    lines.push(
      `DTSTART;TZID=${ICS_TIMEZONE}:${formatIcsDateTime(event.start)}`
    );

    if (event.end) {
      lines.push(`DTEND;TZID=${ICS_TIMEZONE}:${formatIcsDateTime(event.end)}`);
    }

    if (event.rrule) {
      lines.push(`RRULE:${event.rrule}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }

    if (event.url) {
      lines.push(`URL:${escapeIcsText(event.url)}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
};

export const downloadIcsFile = (filename: string, content: string) => {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: 'text/calendar' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};

export const sanitizeForFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
