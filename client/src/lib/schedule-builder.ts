import type { Block, Course, Schedule, TimeBlock } from './types';
import { compareTerms } from './utils';

export const SCHEDULE_RESULT_LIMIT = 100;

export type BuilderBlock = {
  campus: string;
  courseId: string;
  courseTitle: string;
  crn: string;
  display: string;
  location: string;
  timeblocks: TimeBlock[];
};

export type CourseScheduleOption = {
  blocks: BuilderBlock[];
  courseId: string;
  courseTitle: string;
  id: string;
  label: string;
  term: string;
};

export type ScheduleResult = {
  blocks: BuilderBlock[];
  dayCount: number;
  earliestStart: number | null;
  id: string;
  latestEnd: number | null;
  options: CourseScheduleOption[];
};

export type ScheduleBuild = {
  missingCourses: Course[];
  results: ScheduleResult[];
  truncated: boolean;
};

export const DAY_LABELS: Record<string, string> = {
  '1': 'Sun',
  '2': 'Mon',
  '3': 'Tue',
  '4': 'Wed',
  '5': 'Thu',
  '6': 'Fri',
  '7': 'Sat',
};

const blockKey = (block: Block | BuilderBlock) =>
  [
    block.display ?? '',
    block.crn ?? '',
    block.campus ?? '',
    block.location ?? '',
    JSON.stringify(block.timeblocks ?? []),
  ].join('|');

const optionKey = (blocks: BuilderBlock[]) =>
  blocks.map((block) => blockKey(block)).join('::');

const normalizeBlock = (course: Course, block: Block): BuilderBlock => ({
  campus: block.campus ?? '',
  courseId: course._id,
  courseTitle: course.title,
  crn: block.crn ?? '',
  display: block.display ?? '',
  location: block.location ?? '',
  timeblocks: block.timeblocks ?? [],
});

const uniqBlocks = (blocks: BuilderBlock[]) =>
  Array.from(
    blocks
      .reduce<
        Map<string, BuilderBlock>
      >((map, block) => map.set(blockKey(block), block), new Map())
      .values()
  );

const expandBlocks = (blocks: BuilderBlock[]) => {
  const first = blocks[0];

  if (!first) return [];

  const firstKey = blockKey(first);
  const groups: BuilderBlock[][] = [];
  let current: BuilderBlock[] = [];

  blocks.forEach((block) => {
    if (current.length > 0 && blockKey(block) === firstKey) {
      groups.push(uniqBlocks(current));
      current = [block];
    } else {
      current.push(block);
    }
  });

  if (current.length > 0) {
    groups.push(uniqBlocks(current));
  }

  return groups;
};

export const parseVsbMinutes = (value: string | undefined): number | null => {
  if (value === undefined) return null;

  const minutes = parseInt(value, 10);

  return Number.isNaN(minutes) ? null : minutes;
};

export const formatScheduleMinutes = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  const minutePart =
    minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;

  return `${normalizedHour}${minutePart} ${period}`;
};

export const getBlockMeetingLabels = (block: BuilderBlock) => {
  const grouped = block.timeblocks.reduce<Map<string, string[]>>(
    (map, timeblock) => {
      const start = parseVsbMinutes(timeblock.t1);
      const end = parseVsbMinutes(timeblock.t2);

      if (!timeblock.day || start === null || end === null) return map;

      const key = `${formatScheduleMinutes(start)} - ${formatScheduleMinutes(
        end
      )}`;
      const days = map.get(key) ?? [];
      map.set(key, [...days, DAY_LABELS[timeblock.day] ?? timeblock.day]);

      return map;
    },
    new Map()
  );

  const labels = Array.from(grouped, ([time, days]) => {
    return `${days.join(' ')} · ${time}`;
  });

  return labels.length > 0 ? labels : ['No meeting time'];
};

const getMeetings = (blocks: BuilderBlock[]) =>
  blocks.flatMap((block) =>
    block.timeblocks.flatMap((timeblock) => {
      const start = parseVsbMinutes(timeblock.t1);
      const end = parseVsbMinutes(timeblock.t2);

      if (!timeblock.day || start === null || end === null) {
        return [];
      }

      return [{ block, day: timeblock.day, end, start }];
    })
  );

const blockConflicts = (blocks: BuilderBlock[], candidate: BuilderBlock[]) =>
  getMeetings(blocks).some((meeting) =>
    getMeetings(candidate).some(
      (candidateMeeting) =>
        meeting.day === candidateMeeting.day &&
        meeting.start < candidateMeeting.end &&
        candidateMeeting.start < meeting.end
    )
  );

const selfConflicts = (blocks: BuilderBlock[]) => {
  const meetings = getMeetings(blocks);

  return meetings.some((meeting, index) =>
    meetings
      .slice(index + 1)
      .some(
        (candidate) =>
          meeting.day === candidate.day &&
          meeting.start < candidate.end &&
          candidate.start < meeting.end
      )
  );
};

const buildResult = (options: CourseScheduleOption[]): ScheduleResult => {
  const blocks = options.flatMap((option) => option.blocks);
  const meetings = getMeetings(blocks);
  const starts = meetings.map((meeting) => meeting.start);
  const ends = meetings.map((meeting) => meeting.end);
  const days = new Set(meetings.map((meeting) => meeting.day));

  return {
    blocks,
    dayCount: days.size,
    earliestStart: starts.length > 0 ? Math.min(...starts) : null,
    id: options.map((option) => option.id).join('|'),
    latestEnd: ends.length > 0 ? Math.max(...ends) : null,
    options,
  };
};

const optionLabel = (blocks: BuilderBlock[]) => {
  const label = blocks
    .map((block) => block.display)
    .filter(Boolean)
    .join(' + ');

  return label || 'No scheduled meetings';
};

export const getScheduleTerms = (courses: Course[]): string[] =>
  Array.from(
    new Set(
      courses.flatMap((course) =>
        (course.schedule ?? [])
          .map((schedule) => schedule.term)
          .filter((term): term is string => term !== undefined)
      )
    )
  ).sort(compareTerms);

export const getCourseScheduleOptions = (
  course: Course,
  term: string
): CourseScheduleOption[] => {
  const options = (course.schedule ?? [])
    .filter((schedule): schedule is Schedule & { term: string } => {
      return schedule.term === term;
    })
    .flatMap((schedule, scheduleIndex) =>
      expandBlocks(
        (schedule.blocks ?? []).map((block) => normalizeBlock(course, block))
      )
        .filter((blocks) => !selfConflicts(blocks))
        .map((blocks, blockIndex) => ({
          blocks,
          courseId: course._id,
          courseTitle: course.title,
          id: `${course._id}-${term}-${scheduleIndex}-${blockIndex}`,
          label: optionLabel(blocks),
          term,
        }))
    );

  return Array.from(
    options
      .reduce<
        Map<string, CourseScheduleOption>
      >((map, option) => map.set(optionKey(option.blocks), option), new Map())
      .values()
  );
};

export const buildScheduleResults = (
  courses: Course[],
  term: string
): ScheduleBuild => {
  const courseOptions = courses.map((course) => ({
    course,
    options: getCourseScheduleOptions(course, term),
  }));

  const missingCourses = courseOptions
    .filter(({ options }) => options.length === 0)
    .map(({ course }) => course);

  if (courses.length === 0 || missingCourses.length > 0) {
    return {
      missingCourses,
      results: [],
      truncated: false,
    };
  }

  const results: ScheduleResult[] = [];
  let truncated = false;

  const visit = (
    index: number,
    selected: CourseScheduleOption[],
    blocks: BuilderBlock[]
  ) => {
    if (results.length >= SCHEDULE_RESULT_LIMIT) {
      truncated = true;
      return;
    }

    if (index === courseOptions.length) {
      results.push(buildResult(selected));
      return;
    }

    courseOptions[index].options.forEach((option) => {
      if (results.length >= SCHEDULE_RESULT_LIMIT) {
        truncated = true;
        return;
      }

      if (blockConflicts(blocks, option.blocks)) return;

      visit(index + 1, [...selected, option], [...blocks, ...option.blocks]);
    });
  };

  visit(0, [], []);

  return {
    missingCourses,
    results,
    truncated,
  };
};
