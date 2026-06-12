import type { Block, Course, Schedule, TimeBlock } from './types';

const SCHEDULE_RESULT_LIMIT = 100;

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

type ScheduleResult = {
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

export type PinnedScheduleOptions = Record<string, string>;

type ScheduleBuildOptions = {
  allowConflicts?: boolean;
  pinnedOptions?: PinnedScheduleOptions;
};

export type ScheduleConflict = {
  day: string;
  end: number;
  left: BuilderBlock;
  right: BuilderBlock;
  start: number;
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
    JSON.stringify(canonicalTimeblocks(block.timeblocks ?? [])),
  ].join('|');

const optionKey = (blocks: BuilderBlock[]) =>
  blocks
    .map((block) => blockKey(block))
    .sort()
    .join('::');

const timeblockKey = (timeblock: TimeBlock) =>
  [timeblock.day ?? '', timeblock.t1 ?? '', timeblock.t2 ?? ''].join('|');

const canonicalTimeblocks = (timeblocks: TimeBlock[]) =>
  uniqTimeblocks(timeblocks).sort((left, right) =>
    timeblockKey(left).localeCompare(timeblockKey(right))
  );

const uniqTimeblocks = (timeblocks: TimeBlock[]) =>
  Array.from(
    timeblocks
      .reduce<
        Map<string, TimeBlock>
      >((map, timeblock) => map.set(timeblockKey(timeblock), timeblock), new Map())
      .values()
  );

const hashString = (value: string) => {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
};

const optionId = (course: Course, term: string, blocks: BuilderBlock[]) =>
  `${course._id}-${hashString(`${term}|${optionKey(blocks)}`)}`;

const normalizeBlock = (course: Course, block: Block): BuilderBlock => ({
  campus: block.campus ?? '',
  courseId: course._id,
  courseTitle: course.title,
  crn: block.crn ?? '',
  display: block.display ?? '',
  location: block.location ?? '',
  timeblocks: uniqTimeblocks(block.timeblocks ?? []),
});

const uniqBlocks = (blocks: BuilderBlock[]) =>
  Array.from(
    blocks
      .reduce<
        Map<string, BuilderBlock>
      >((map, block) => map.set(blockKey(block), block), new Map())
      .values()
  );

const repeatedBlockIndexes = (blocks: BuilderBlock[]) => {
  const indexesByKey = blocks.reduce<Map<string, number[]>>(
    (map, block, index) => {
      const key = blockKey(block);
      const indexes = map.get(key) ?? [];
      map.set(key, [...indexes, index]);
      return map;
    },
    new Map()
  );

  return Array.from(indexesByKey.values())
    .filter((indexes) => indexes.length > 1)
    .sort((left, right) => {
      if (left.length !== right.length) return right.length - left.length;
      return left[0] - right[0];
    })[0];
};

const expandBlocks = (blocks: BuilderBlock[]): BuilderBlock[][] => {
  if (blocks.length === 0) return [];

  const indexes = repeatedBlockIndexes(blocks);

  if (indexes === undefined) return [uniqBlocks(blocks)];

  const baseGroups =
    indexes[0] === 0
      ? indexes.map((start, index) =>
          blocks.slice(start, indexes[index + 1] ?? blocks.length)
        )
      : indexes.reduce<BuilderBlock[][]>((groups, end) => {
          const start =
            groups.length === 0 ? 0 : indexes[groups.length - 1] + 1;

          return [...groups, blocks.slice(start, end + 1)];
        }, []);

  const lastIndex = indexes[indexes.length - 1];
  const groups =
    indexes[0] === 0 || lastIndex === blocks.length - 1
      ? baseGroups
      : [...baseGroups, blocks.slice(lastIndex + 1)];

  return groups.flatMap(expandBlocks);
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

type Meeting = {
  block: BuilderBlock;
  day: string;
  end: number;
  start: number;
};

const getMeetings = (blocks: BuilderBlock[]): Meeting[] =>
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

const getMeetingConflicts = (
  blocks: BuilderBlock[],
  candidate: BuilderBlock[]
): ScheduleConflict[] =>
  getMeetings(blocks).flatMap((meeting) =>
    getMeetings(candidate).flatMap((candidateMeeting) => {
      if (
        meeting.day !== candidateMeeting.day ||
        meeting.start >= candidateMeeting.end ||
        candidateMeeting.start >= meeting.end
      ) {
        return [];
      }

      return [
        {
          day: meeting.day,
          end: Math.min(meeting.end, candidateMeeting.end),
          left: meeting.block,
          right: candidateMeeting.block,
          start: Math.max(meeting.start, candidateMeeting.start),
        },
      ];
    })
  );

const blockConflicts = (blocks: BuilderBlock[], candidate: BuilderBlock[]) =>
  getMeetingConflicts(blocks, candidate).length > 0;

const isSubset = (blocks: BuilderBlock[], candidate: BuilderBlock[]) => {
  const candidateKeys = new Set(candidate.map((block) => blockKey(block)));

  return blocks.every((block) => candidateKeys.has(blockKey(block)));
};

const expandNonConflictingBlocks = (candidateBlocks: BuilderBlock[]) => {
  const blocks = uniqBlocks(candidateBlocks);
  const groups: BuilderBlock[][] = [];

  const visit = (index: number, selected: BuilderBlock[]) => {
    if (index === blocks.length) {
      if (selected.length > 0) groups.push(selected);
      return;
    }

    const block = blocks[index];

    if (!blockConflicts(selected, [block])) {
      visit(index + 1, [...selected, block]);
    }

    visit(index + 1, selected);
  };

  visit(0, []);

  return groups.filter(
    (group) =>
      !groups.some(
        (candidate) =>
          candidate.length > group.length && isSubset(group, candidate)
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

export const getCourseScheduleOptions = (
  course: Course,
  term: string
): CourseScheduleOption[] => {
  const options = (course.schedule ?? [])
    .filter((schedule): schedule is Schedule & { term: string } => {
      return schedule.term === term;
    })
    .flatMap((schedule) =>
      expandBlocks(
        (schedule.blocks ?? []).map((block) => normalizeBlock(course, block))
      )
        .flatMap(expandNonConflictingBlocks)
        .map((blocks) => ({
          blocks,
          courseId: course._id,
          courseTitle: course.title,
          id: optionId(course, term, blocks),
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

export const getScheduleConflicts = (
  courses: Course[],
  term: string
): ScheduleConflict[] => {
  const courseOptions = courses.map((course) => ({
    course,
    options: getCourseScheduleOptions(course, term),
  }));

  const conflicts: ScheduleConflict[] = [];

  courseOptions.forEach((left, leftIndex) => {
    courseOptions.slice(leftIndex + 1).forEach((right) => {
      left.options.forEach((leftOption) => {
        right.options.forEach((rightOption) => {
          conflicts.push(
            ...getMeetingConflicts(leftOption.blocks, rightOption.blocks)
          );
        });
      });
    });
  });

  return Array.from(
    conflicts
      .reduce<Map<string, ScheduleConflict>>((map, conflict) => {
        const key = [
          conflict.left.courseId,
          conflict.left.display,
          conflict.left.crn,
          conflict.right.courseId,
          conflict.right.display,
          conflict.right.crn,
          conflict.day,
          conflict.start,
          conflict.end,
        ].join('|');

        return map.set(key, conflict);
      }, new Map())
      .values()
  ).sort((a, b) => {
    if (a.day !== b.day) return a.day.localeCompare(b.day);
    if (a.start !== b.start) return a.start - b.start;
    return a.left.courseId.localeCompare(b.left.courseId);
  });
};

export const buildScheduleResults = (
  courses: Course[],
  term: string,
  options: ScheduleBuildOptions = {}
): ScheduleBuild => {
  const { allowConflicts = false, pinnedOptions = {} } = options;
  const courseOptions = courses.map((course) => {
    const options = getCourseScheduleOptions(course, term);
    const pinnedOptionId = pinnedOptions[course._id];
    const matchingPinnedOptions =
      pinnedOptionId === undefined
        ? []
        : options.filter((option) => option.id === pinnedOptionId);

    return {
      course,
      options:
        pinnedOptionId === undefined || matchingPinnedOptions.length === 0
          ? options
          : matchingPinnedOptions,
    };
  });

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

      if (!allowConflicts && blockConflicts(blocks, option.blocks)) return;

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
