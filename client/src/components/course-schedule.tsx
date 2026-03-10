import { ChevronDown } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

import * as buildingCodes from '../assets/building-codes.json';
import * as buildingCoordinates from '../assets/building-coordinates.json';
import { type IcsEventOptions, sanitizeForFilename } from '../lib/calendar';
import type { Block, Schedule, TimeBlock } from '../lib/types';
import type { Course } from '../lib/types';
import {
  formatDisplayTime,
  getCurrentTerm,
  groupBy,
  mapValues,
  sortBy,
  sortTerms,
  uniq,
  uniqBy,
} from '../lib/utils';
import { AddToCalendarButton } from './add-to-calendar-button';
import { BuildingLocation } from './building-location';
import { Tooltip } from './tooltip';

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

const DEFAULT_MEETING_COUNT = 13;

const TERM_START_CONFIG = {
  Winter: { startMonth: 1, offsetDays: 6 },
  Summer: { startMonth: 5, offsetDays: 6 },
  Fall: { startMonth: 9, offsetDays: 6 },
} as const;

type ScheduleBlock = Omit<Block, 'timeblocks' | 'location' | 'display'> & {
  location: string;
  display: string;
  timeblocks: RepeatingBlock[];
};

type RepeatingBlock = {
  days: string[];
  startTime: string;
  endTime: string;
};

type TermSeason = keyof typeof TERM_START_CONFIG;

const VSBtimeToDisplay = (time: string) => {
  const totalMinutes = parseInt(time, 10);

  if (Number.isNaN(totalMinutes)) {
    return time;
  }

  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${hour.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}`;
};

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

  if (jsDay < 0 || jsDay > 6) return null;

  return jsDay;
};

const getFirstOccurrenceForTermDay = (
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

const parseTimeString = (
  value: string
): { hour: number; minute: number } | null => {
  const trimmed = value.trim();
  const [hourString, minuteString] = trimmed.split(':');

  const hour = parseInt(hourString, 10);
  const minute = parseInt(minuteString, 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return { hour, minute };
};

const buildScheduleEvents = (
  block: ScheduleBlock,
  course: Course,
  term: string
): IcsEventOptions[] => {
  const courseUrl = `https://mcgill.courses/${course._id}`;

  const summary = `${course._id} ${block.display}`.trim();

  const descriptionParts = [
    course.title,
    `Section: ${block.display}`,
    `Term: ${term}`,
    block.campus ? `Campus: ${block.campus}` : null,
  ].filter((part): part is string => Boolean(part));

  const location = block.location.split(';')[0]?.trim() ?? block.location;

  const events: IcsEventOptions[] = [];

  block.timeblocks.forEach((tb, index) => {
    if (!tb.startTime || !tb.endTime || tb.days.length === 0) return;

    const sortedDays = [...tb.days].sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    const firstDay = sortedDays[0];
    const occurrence = getFirstOccurrenceForTermDay(term, firstDay);

    const startTime = parseTimeString(tb.startTime);
    const endTime = parseTimeString(tb.endTime);

    if (!occurrence || !startTime || !endTime) return;

    const eventStart = new Date(occurrence);
    eventStart.setHours(startTime.hour, startTime.minute, 0, 0);

    const eventEnd = new Date(occurrence);
    eventEnd.setHours(endTime.hour, endTime.minute, 0, 0);

    const byDayCodes = sortedDays
      .map((day) => DAY_CODE_MAP[day])
      .filter((code): code is string => Boolean(code));

    const uniqueByDayCodes = Array.from(new Set(byDayCodes)).sort(
      (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
    );

    const occurrencesPerWeek = Math.max(1, uniqueByDayCodes.length);

    const rruleParts = [
      'FREQ=WEEKLY',
      'INTERVAL=1',
      `COUNT=${DEFAULT_MEETING_COUNT * occurrencesPerWeek}`,
    ];

    if (uniqueByDayCodes.length > 0) {
      rruleParts.push(`BYDAY=${uniqueByDayCodes.join(',')}`);
    }

    const uidBase = sanitizeForFilename(
      `${course._id}-${block.display}-${term}-${tb.startTime}-${tb.endTime}-${index}`
    );
    const uid = `${(uidBase || 'schedule').slice(0, 64)}@mcgill.courses`;

    events.push({
      start: eventStart,
      end: eventEnd,
      summary,
      description: descriptionParts.join('\n'),
      location,
      url: courseUrl,
      uid,
      rrule: rruleParts.join(';'),
    });
  });

  return events;
};

const getSections = (
  schedules: Schedule[]
): Record<string, ScheduleBlock[]> => {
  // Group the unique sections by term, i.e Lec 001, Lec 002, Lab 003, etc.
  const termBlocks = mapValues(
    groupBy(schedules, (s) => s.term),
    (scheds) =>
      sortBy(
        uniqBy(
          scheds.flatMap((s) => s.blocks ?? []),
          (b) => b.display
        ),
        (b) => b.display?.split(' ', 2)[1]
      )
  );

  // For each section, group together all timeblocks that occur at the same time
  // into a single RepeatingBlock.
  const termBlockTimes = mapValues(termBlocks, (blocks) =>
    blocks.map((b) => ({
      ...b,
      location: b.location ?? '',
      display: b.display ?? '',
      timeblocks: Object.entries(
        groupBy(b.timeblocks ?? [], (tb: TimeBlock) => `${tb.t1}-${tb.t2}`)
      ).map(([time, tbs]) => {
        const [t1, t2] = time.split('-', 2);

        return {
          days: tbs.map((tb) => tb.day).filter((d): d is string => d != null),
          startTime: VSBtimeToDisplay(t1),
          endTime: VSBtimeToDisplay(t2),
        };
      }),
    }))
  );

  return termBlockTimes;
};

const BlockLocation = ({ location }: { location: string }) => {
  const code = location.split(' ')[0];

  const [isLocationOpen, setIsLocationOpen] = useState(false);

  const coordinates =
    buildingCoordinates[code as keyof typeof buildingCoordinates];

  return (
    <Fragment>
      {coordinates !== null ? (
        <button
          type='button'
          className='relative whitespace-nowrap'
          onClick={() => setIsLocationOpen(true)}
        >
          <Tooltip text={buildingCodes[code as keyof typeof buildingCodes]}>
            <p className='xs:text-sm inline-block cursor-pointer text-xs leading-7 sm:text-base lg:text-sm xl:text-base'>
              {location}
            </p>
          </Tooltip>
        </button>
      ) : (
        <span className='relative whitespace-nowrap'>
          <Tooltip text={buildingCodes[code as keyof typeof buildingCodes]}>
            <p className='xs:text-sm inline-block text-xs leading-7 sm:text-base lg:text-sm xl:text-base'>
              {location}
            </p>
          </Tooltip>
        </span>
      )}
      <BuildingLocation
        title={buildingCodes[code as keyof typeof buildingCodes]}
        code={code}
        open={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
      />
    </Fragment>
  );
};

type TimeblockDaysProps = {
  days: string[];
};

const TimeblockDays = ({ days }: TimeblockDaysProps) => {
  const dayNums = days.map((d) => parseInt(d, 10));
  return (
    <div className='flex gap-1'>
      {['M', 'T', 'W', 'T', 'F'].map((day, i) => (
        <span
          key={day + i}
          className={twMerge(
            'text-sm sm:text-base lg:text-sm xl:text-base',
            dayNums.includes(i + 2)
              ? 'font-semibold text-gray-800 dark:text-gray-100'
              : 'font-extralight text-gray-400 dark:text-gray-400'
          )}
        >
          {day}
        </span>
      ))}
    </div>
  );
};

type ScheduleRowProps = {
  block: ScheduleBlock;
  course: Course;
  term: string;
};

const ScheduleRow = ({ block, course, term }: ScheduleRowProps) => {
  const events = buildScheduleEvents(block, course, term);

  const filenameBase =
    sanitizeForFilename(`${course._id}-${block.display}-${term}`) || 'schedule';

  const calendarPayload =
    events.length > 0
      ? {
          filename: `${filenameBase}.ics`,
          events,
          prodId: '-//mcgill.courses//Schedule//EN',
        }
      : null;

  const hasCalendarData = Boolean(calendarPayload);

  const locationEntries = block.location
    .split(';')
    .map((location) => location.trim())
    .filter((location) => location.length > 0);

  const timeRanges = block.timeblocks
    .filter(
      (timeblock) => Boolean(timeblock.startTime) && Boolean(timeblock.endTime)
    )
    .map(
      (timeblock) =>
        `${formatDisplayTime(timeblock.startTime)} - ${formatDisplayTime(timeblock.endTime)}`
    );

  const daySets = block.timeblocks
    .map((timeblock) =>
      timeblock.days.filter(
        (day) => typeof day === 'string' && day.trim().length > 0
      )
    )
    .filter((days) => days.length > 0);

  const handleCopyCrn = () => {
    if (!block.crn) return;

    toast.promise(navigator.clipboard.writeText(block.crn), {
      success: `Copied CRN for ${block.display} to clipboard`,
      loading: undefined,
      error: 'Something went wrong when trying to copy section CRN',
    });
  };

  return (
    <tr className='p-2 text-left even:bg-slate-100 even:dark:bg-[rgb(48,48,48)]'>
      <td className='xs:text-sm pl-4 text-xs font-semibold whitespace-nowrap sm:pl-6 sm:text-base lg:pl-4 lg:text-sm xl:text-base'>
        {block.display}
      </td>
      <td className='py-2 text-gray-700 dark:text-gray-300'>
        <div className='flex flex-col items-start pl-1 text-center font-medium'>
          {locationEntries.length > 0 ? (
            locationEntries.map((location, index) => (
              <span key={`${location}-${index}`}>
                <BlockLocation location={location} />
              </span>
            ))
          ) : (
            <span
              aria-hidden
              className='invisible text-sm font-medium select-none sm:text-base'
            >
              Placeholder
            </span>
          )}
        </div>
      </td>
      <td className='xs:text-sm py-2 text-xs font-medium whitespace-nowrap sm:text-base lg:text-sm xl:text-base'>
        {timeRanges.length > 0 ? (
          timeRanges.map((range, index) => <div key={index}>{range}</div>)
        ) : (
          <span aria-hidden className='invisible font-medium select-none'>
            Placeholder
          </span>
        )}
      </td>
      <td className='xs:pr-0 p-2'>
        {daySets.length > 0 ? (
          daySets.map((days, index) => (
            <TimeblockDays days={days} key={index} />
          ))
        ) : (
          <div
            aria-hidden
            className='pointer-events-none leading-none opacity-0'
          >
            <TimeblockDays days={['2', '3', '4', '5', '6']} />
          </div>
        )}
      </td>
      <td
        className={twMerge(
          'hidden text-center text-sm font-medium sm:table-cell sm:pr-2 lg:pr-0 xl:pr-2',
          block.crn
            ? 'cursor-pointer text-gray-500 dark:text-gray-400'
            : 'cursor-default text-gray-400 dark:text-gray-500'
        )}
        onClick={block.crn ? handleCopyCrn : undefined}
      >
        {block.crn ? (
          <span>
            <span className='lg:hidden xl:inline'>CRN: </span>
            {block.crn}
          </span>
        ) : (
          'CRN unavailable'
        )}
      </td>
      <td className='xs:table-cell hidden px-2 whitespace-nowrap'>
        <AddToCalendarButton
          payload={calendarPayload}
          ariaLabel={`Add ${block.display} schedule to calendar`}
          title={
            hasCalendarData
              ? 'Add section to calendar'
              : 'Schedule calendar download unavailable'
          }
          variant='ghost'
        />
      </td>
    </tr>
  );
};

const getDefaultTerm = (offeredTerms: string[]) => {
  const currentTerm = getCurrentTerm();
  return offeredTerms.includes(currentTerm) ? currentTerm : offeredTerms.at(0);
};

type CourseScheduleProps = {
  course: Course;
  className?: string;
};

export const CourseSchedule = ({ course, className }: CourseScheduleProps) => {
  const schedules = course.schedule;

  if (!schedules) {
    return null;
  }

  const offeredTerms = sortTerms(
    uniq(schedules.map((schedule) => schedule.term)).filter(
      (term): term is string => term != null && course.terms.includes(term)
    )
  );

  const [selectedTerm, setSelectedTerm] = useState(
    getDefaultTerm(offeredTerms)
  );

  const [showAll, setShowAll] = useState(false);

  const scheduleByTerm = useMemo(() => getSections(schedules), [course]);

  const [blocks, setBlocks] = useState(
    selectedTerm ? scheduleByTerm[selectedTerm] : undefined
  );

  useEffect(() => {
    setSelectedTerm(getDefaultTerm(offeredTerms));
  }, [course]);

  useEffect(() => {
    setBlocks(selectedTerm ? scheduleByTerm[selectedTerm] : undefined);
  }, [course, selectedTerm]);

  if (!selectedTerm || !blocks) {
    return null;
  }

  return (
    <div
      className={twMerge(
        'flex flex-col text-gray-800 shadow-sm lg:border-t-0',
        className
      )}
    >
      <div className='flex'>
        {offeredTerms.map((term, i) => (
          <button
            key={i}
            className={twMerge(
              `flex-1 cursor-pointer border-b-neutral-200 p-2 text-center text-sm font-medium transition duration-300 ease-in-out sm:text-base dark:border-b-neutral-600 dark:text-gray-200`,
              term === selectedTerm
                ? 'bg-slate-50 dark:bg-neutral-800'
                : 'bg-slate-200 hover:bg-slate-100 dark:bg-neutral-600 dark:hover:bg-neutral-700',
              i === 0 ? 'rounded-tl-lg' : '',
              i === offeredTerms.length - 1 ? 'rounded-tr-lg' : ''
            )}
            onClick={() => {
              setSelectedTerm(term);
              setShowAll(false);
            }}
          >
            {term}
          </button>
        ))}
      </div>
      <div className='flex flex-col rounded-b-lg bg-slate-50 dark:bg-neutral-800 dark:text-gray-200'>
        <table className='w-full'>
          <tbody>
            {blocks.length <= 5 || showAll
              ? blocks.map((s, i) => (
                  <ScheduleRow
                    key={i}
                    block={s}
                    course={course}
                    term={selectedTerm}
                  />
                ))
              : blocks
                  .slice(0, 5)
                  .map((s, i) => (
                    <ScheduleRow
                      key={i}
                      block={s}
                      course={course}
                      term={selectedTerm}
                    />
                  ))}
          </tbody>
        </table>
        {blocks.length > 5 && (
          <div className='flex flex-row justify-center'>
            <button
              className='flex flex-row items-center justify-center py-2 text-center font-medium transition duration-300 ease-in-out hover:cursor-pointer dark:text-gray-200'
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show less' : 'Show all'}
              <ChevronDown
                className={`${
                  showAll ? 'rotate-180' : ''
                } mx-2 size-5 text-gray-900 dark:text-gray-300`}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
