import { twMerge } from 'tailwind-merge';

import {
  type BuilderBlock,
  type Meeting,
  formatScheduleMinutes,
  getMeetings,
} from '../lib/schedule-builder';

const DAYS = [
  { code: '1', label: 'Sun' },
  { code: '2', label: 'Mon' },
  { code: '3', label: 'Tue' },
  { code: '4', label: 'Wed' },
  { code: '5', label: 'Thu' },
  { code: '6', label: 'Fri' },
  { code: '7', label: 'Sat' },
];

const HOUR_HEIGHT = 52;

const COURSE_COLORS = [
  'border-red-200 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-950/60 dark:text-red-100',
  'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/60 dark:text-sky-100',
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-100',
  'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-100',
  'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-500/40 dark:bg-violet-950/60 dark:text-violet-100',
  'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-500/40 dark:bg-cyan-950/60 dark:text-cyan-100',
];

type PositionedMeeting = Meeting & {
  lane: number;
  laneCount: number;
};

type VisualScheduleProps = {
  blocks: BuilderBlock[];
  className?: string;
  pinnedCourseIds?: readonly string[];
  onBlockClick?: (block: BuilderBlock) => void;
};

const getHourRange = (meetings: Meeting[]) => {
  if (meetings.length === 0) {
    return { endHour: 18, startHour: 8 };
  }

  const startHour = Math.min(
    8,
    Math.floor(Math.min(...meetings.map((meeting) => meeting.start)) / 60)
  );

  const endHour = Math.max(
    18,
    Math.ceil(Math.max(...meetings.map((meeting) => meeting.end)) / 60)
  );

  return { endHour, startHour };
};

const getPositionedDayMeetings = (meetings: Meeting[]) => {
  const sorted = meetings
    .map((meeting, index) => ({ index, meeting }))
    .sort(
      (left, right) =>
        left.meeting.start - right.meeting.start ||
        left.meeting.end - right.meeting.end ||
        left.index - right.index
    );
  const positioned: (PositionedMeeting & { index: number })[] = [];
  let cluster: typeof sorted = [];
  let clusterEnd = 0;

  const flush = () => {
    const lanes: number[] = [];
    const clusterPositioned = cluster.map(({ index, meeting }) => {
      const availableLane = lanes.findIndex((end) => end <= meeting.start);
      const lane = availableLane === -1 ? lanes.length : availableLane;

      lanes[lane] = meeting.end;

      return { ...meeting, index, lane };
    });
    const laneCount = Math.max(1, lanes.length);

    positioned.push(
      ...clusterPositioned.map((meeting) => ({ ...meeting, laneCount }))
    );
    cluster = [];
    clusterEnd = 0;
  };

  sorted.forEach((meeting) => {
    if (cluster.length > 0 && meeting.meeting.start >= clusterEnd) {
      flush();
    }

    cluster.push(meeting);
    clusterEnd = Math.max(clusterEnd, meeting.meeting.end);
  });

  if (cluster.length > 0) {
    flush();
  }

  return positioned
    .sort((left, right) => left.index - right.index)
    .map(({ block, day, end, lane, laneCount, start }) => ({
      block,
      day,
      end,
      lane,
      laneCount,
      start,
    }));
};

const getPositionedMeetings = (meetings: Meeting[]) => {
  const meetingsByDay = meetings.reduce<Map<string, Meeting[]>>(
    (map, meeting) => {
      map.set(meeting.day, [...(map.get(meeting.day) ?? []), meeting]);

      return map;
    },
    new Map()
  );

  return Array.from(meetingsByDay.values()).flatMap(getPositionedDayMeetings);
};

const formatMeetingTime = (meeting: Meeting) =>
  `${formatScheduleMinutes(meeting.start)} - ${formatScheduleMinutes(
    meeting.end
  )}`;

const formatCourseId = (courseId: string) =>
  courseId.length > 4
    ? `${courseId.slice(0, 4)} ${courseId.slice(4)}`
    : courseId;

export const VisualSchedule = ({
  blocks,
  className,
  pinnedCourseIds = [],
  onBlockClick,
}: VisualScheduleProps) => {
  const meetings = getMeetings(blocks);
  const positionedMeetings = getPositionedMeetings(meetings);
  const { endHour, startHour } = getHourRange(meetings);
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, index) => startHour + index
  );
  const height = (endHour - startHour) * HOUR_HEIGHT;
  const courseIds = Array.from(new Set(blocks.map((block) => block.courseId)));
  const pinnedCourseIdSet = new Set(pinnedCourseIds);
  const colorForCourse = (courseId: string) =>
    COURSE_COLORS[courseIds.indexOf(courseId) % COURSE_COLORS.length];
  const meetingDays = new Set(meetings.map((meeting) => meeting.day));
  const days = DAYS.filter(
    (day) => (day.code >= '2' && day.code <= '6') || meetingDays.has(day.code)
  );
  const gridTemplateColumns = `48px repeat(${days.length}, minmax(104px, 1fr))`;

  if (meetings.length === 0) {
    return (
      <div
        className={twMerge(
          'flex min-h-64 items-center justify-center rounded-md bg-white/70 text-sm font-medium text-gray-500 ring-1 ring-slate-200 dark:bg-neutral-900/40 dark:text-gray-400 dark:ring-neutral-800',
          className
        )}
      >
        No scheduled meeting times
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        'overflow-hidden rounded-md bg-white/80 ring-1 ring-slate-200 dark:bg-neutral-900/40 dark:ring-neutral-800',
        className
      )}
    >
      <div className='overflow-x-auto'>
        <div style={{ minWidth: 48 + days.length * 104 }}>
          <div
            className='grid bg-slate-50/70 text-xs font-medium text-gray-500 dark:bg-neutral-950/30 dark:text-gray-400'
            style={{ gridTemplateColumns }}
          >
            <div className='bg-white/30 dark:bg-neutral-900/30' />
            {days.map((day, index) => {
              const hasOuterBorders = day.code === '3' || day.code === '5';
              const previousHasRightBorder =
                days[index - 1]?.code === '3' || days[index - 1]?.code === '5';

              return (
                <div
                  className={twMerge(
                    'px-2 py-1.5 text-center',
                    !previousHasRightBorder &&
                      'border-l border-slate-200 dark:border-neutral-800',
                    hasOuterBorders &&
                      'border-x border-slate-200 dark:border-neutral-800',
                    index % 2 === 1 && 'bg-white/40 dark:bg-white/[0.02]'
                  )}
                  key={day.code}
                >
                  {day.label}
                </div>
              );
            })}
          </div>
          <div
            className='grid bg-white/30 dark:bg-neutral-950/20'
            style={{ gridTemplateColumns }}
          >
            <div
              className='relative bg-slate-50/40 dark:bg-neutral-950/20'
              style={{ height }}
            >
              {hours.slice(0, -1).map((hour) => (
                <div
                  className='absolute right-1.5 -translate-y-2 text-[10px] text-gray-400 tabular-nums dark:text-gray-500'
                  key={hour}
                  style={{ top: (hour - startHour) * HOUR_HEIGHT }}
                >
                  {formatScheduleMinutes(hour * 60)}
                </div>
              ))}
            </div>
            {days.map((day, dayIndex) => {
              const hasOuterBorders = day.code === '3' || day.code === '5';
              const nextHasLeftBorder =
                days[dayIndex + 1]?.code === '3' ||
                days[dayIndex + 1]?.code === '5';

              return (
                <div
                  className={twMerge(
                    'relative border-slate-100 dark:border-neutral-800',
                    dayIndex === 0 &&
                      'border-l border-slate-200 dark:border-neutral-800',
                    !nextHasLeftBorder && 'border-r last:border-r-0',
                    hasOuterBorders &&
                      'border-x border-slate-200 dark:border-neutral-800',
                    dayIndex % 2 === 1 && 'bg-slate-50/35 dark:bg-white/[0.02]'
                  )}
                  key={day.code}
                  style={{ height }}
                >
                  {hours.slice(0, -1).map((hour) => (
                    <div
                      className='absolute right-0 left-0 border-t border-slate-100/80 dark:border-neutral-800/80'
                      key={hour}
                      style={{ top: (hour - startHour) * HOUR_HEIGHT }}
                    />
                  ))}
                  {positionedMeetings
                    .filter((meeting) => meeting.day === day.code)
                    .map((meeting) => {
                      const top =
                        ((meeting.start - startHour * 60) / 60) * HOUR_HEIGHT;
                      const meetingHeight = Math.max(
                        34,
                        ((meeting.end - meeting.start) / 60) * HOUR_HEIGHT
                      );
                      const showDisplay = meetingHeight >= 42;
                      const showTime = meetingHeight >= 38;
                      const showLocation = meetingHeight >= 78;
                      const isPinned = pinnedCourseIdSet.has(
                        meeting.block.courseId
                      );
                      const title = [
                        formatCourseId(meeting.block.courseId),
                        meeting.block.display,
                        formatMeetingTime(meeting),
                        meeting.block.location,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      const left =
                        meeting.lane === 0
                          ? '0.25rem'
                          : `calc(${(meeting.lane / meeting.laneCount) * 100}% + 0.25rem)`;
                      const width = `calc(${100 / meeting.laneCount}% - 0.5rem)`;
                      const blockClassName = twMerge(
                        'absolute z-10 flex overflow-hidden rounded-sm border p-1.5 text-left text-xs shadow-sm',
                        onBlockClick &&
                          'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500',
                        isPinned && 'ring-2 ring-gray-900 dark:ring-gray-100',
                        colorForCourse(meeting.block.courseId)
                      );
                      const content = (
                        <div className='flex min-h-0 min-w-0 flex-1 flex-col justify-start'>
                          <div className='flex min-w-0 flex-col gap-px sm:flex-row sm:items-baseline sm:justify-between sm:gap-1'>
                            <div className='truncate text-[10px] leading-3.5 font-semibold'>
                              {formatCourseId(meeting.block.courseId)}
                            </div>
                            {showDisplay && (
                              <div className='truncate text-[9px] leading-3 font-medium opacity-80 sm:text-right'>
                                {meeting.block.display || 'Section'}
                              </div>
                            )}
                          </div>
                          {showTime && (
                            <div className='truncate text-[9px] leading-3 font-medium tabular-nums opacity-75'>
                              {formatMeetingTime(meeting)}
                            </div>
                          )}
                          {showLocation && meeting.block.location && (
                            <div className='truncate text-[9px] leading-3 opacity-70'>
                              {meeting.block.location}
                            </div>
                          )}
                        </div>
                      );

                      if (onBlockClick) {
                        return (
                          <button
                            aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${formatCourseId(meeting.block.courseId)} ${meeting.block.display || 'Section'}`}
                            aria-pressed={isPinned}
                            className={blockClassName}
                            key={`${meeting.block.courseId}-${meeting.block.display}-${meeting.block.crn}-${meeting.day}-${meeting.start}-${meeting.end}`}
                            onClick={() => onBlockClick(meeting.block)}
                            style={{ height: meetingHeight, left, top, width }}
                            title={title}
                            type='button'
                          >
                            {content}
                          </button>
                        );
                      }

                      return (
                        <div
                          className={blockClassName}
                          key={`${meeting.block.courseId}-${meeting.block.display}-${meeting.block.crn}-${meeting.day}-${meeting.start}-${meeting.end}`}
                          style={{ height: meetingHeight, left, top, width }}
                          title={title}
                        >
                          {content}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
