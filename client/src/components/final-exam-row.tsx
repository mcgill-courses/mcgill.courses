import { Dot } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import finalExamsData from '../assets/final-exams.json';
import { sanitizeForFilename } from '../lib/calendar';
import { getCurrentTerm } from '../lib/utils';
import type { Course } from '../model/course';
import { AddToCalendarButton } from './add-to-calendar-button';

type RawFinalExam = {
  id: string;
  section?: string;
  exam: {
    format?: string | null;
    type?: string | null;
    location?: string | null;
  };
  start_time?: string | null;
  end_time?: string | null;
};

type FinalExamTerm = {
  term: string;
  url?: string | null;
  exams: RawFinalExam[];
};

type GroupedExam = {
  key: string;
  start_time?: string | null;
  end_time?: string | null;
  exam: RawFinalExam['exam'];
  sections: string[];
};

const finalExams = finalExamsData as FinalExamTerm[];

const parseDate = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateLabel = (start: Date | null) => {
  if (!start) return 'Date TBA';

  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(start);
};

const formatTimeLabel = (start: Date | null, end: Date | null) => {
  if (!start && !end) return 'Time TBA';

  const formatTimePart = (date: Date | null) => {
    if (!date) return null;

    const formatted = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    })
      .format(date)
      .toUpperCase();

    const withoutMinutes = formatted.includes(':00')
      ? formatted.replace(':00', '')
      : formatted;

    return withoutMinutes.replace(/\s+/g, '');
  };

  const startLabel = formatTimePart(start);
  const endLabel = formatTimePart(end);

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  return startLabel ?? endLabel ?? 'Time TBA';
};

const sortExams = (exams: RawFinalExam[]): RawFinalExam[] => {
  const toSortable = (value?: string | null) => value ?? '';

  const compareSections = (a?: string, b?: string) =>
    toSortable(a).localeCompare(toSortable(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    });

  return exams.slice().sort((a, b) => {
    const aStart = toSortable(a.start_time);
    const bStart = toSortable(b.start_time);

    if (aStart && bStart) {
      const cmp = aStart.localeCompare(bStart);
      if (cmp !== 0) return cmp;
    } else if (aStart) {
      return -1;
    } else if (bStart) {
      return 1;
    }

    return compareSections(a.section, b.section);
  });
};

const groupExams = (exams: RawFinalExam[]): GroupedExam[] => {
  const sectionComparator = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

  const grouped: {
    key: string;
    start_time?: string | null;
    end_time?: string | null;
    exam: RawFinalExam['exam'];
    sections: Set<string>;
  }[] = [];

  const indexByKey = new Map<string, number>();

  exams.forEach((exam) => {
    const groupKey = [
      exam.id,
      exam.start_time ?? '',
      exam.end_time ?? '',
      exam.exam.location ?? '',
      exam.exam.type ?? '',
      exam.exam.format ?? '',
    ].join('|');

    const existingIndex = indexByKey.get(groupKey);
    const section = exam.section?.trim();

    if (existingIndex !== undefined) {
      if (section) {
        grouped[existingIndex].sections.add(section);
      }

      return;
    }

    const sections = new Set<string>();

    if (section) {
      sections.add(section);
    }

    grouped.push({
      key: groupKey,
      start_time: exam.start_time,
      end_time: exam.end_time,
      exam: exam.exam,
      sections,
    });

    indexByKey.set(groupKey, grouped.length - 1);
  });

  return grouped.map((entry) => ({
    key: entry.key,
    start_time: entry.start_time,
    end_time: entry.end_time,
    exam: entry.exam,
    sections: Array.from(entry.sections).sort(sectionComparator),
  }));
};

const renderDetailLine = (
  parts: string[],
  keyPrefix: string,
  className?: string
) => {
  if (parts.length === 0) return null;

  return (
    <div className={twMerge('flex flex-wrap items-center', className)}>
      {parts.map((part, index) => (
        <span key={`${keyPrefix}-${index}`} className='flex items-center'>
          {index > 0 && (
            <Dot className='size-4 shrink-0 text-gray-400 dark:text-gray-500' />
          )}
          <span>{part}</span>
        </span>
      ))}
    </div>
  );
};

type FinalExamRowProps = {
  course: Course;
  className?: string;
};

export const FinalExamRow = ({ course, className }: FinalExamRowProps) => {
  const currentTerm = getCurrentTerm();

  const termEntry = finalExams.find((entry) => entry.term === currentTerm);

  if (!termEntry) {
    return null;
  }

  const courseExams = termEntry.exams.filter((exam) => exam.id === course._id);

  if (courseExams.length === 0) {
    return null;
  }

  const exams = sortExams(courseExams);

  const sectionCount = courseExams.reduce((acc, exam) => {
    if (exam.section) acc.add(exam.section);
    return acc;
  }, new Set<string>()).size;

  const groupedExams = groupExams(exams);

  const headerDetail =
    sectionCount > 0
      ? `${sectionCount} ${sectionCount === 1 ? 'section' : 'sections'} scheduled`
      : 'Schedule published';

  const highlightTarget =
    [course.subject, course.code].filter(Boolean).join(' ') ||
    course._id ||
    course.title;

  const encodedHighlight = encodeURIComponent(highlightTarget);

  const examScheduleUrl = termEntry.url
    ? `${termEntry.url}#:~:text=${encodedHighlight}`
    : undefined;

  return (
    <div
      className={twMerge(
        'rounded-md bg-slate-50 p-4 shadow-sm dark:bg-neutral-800',
        className
      )}
    >
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
            Final Exam
          </p>
          <p className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {currentTerm}
          </p>
        </div>
        <p className='text-sm text-gray-600 dark:text-gray-300'>
          {headerDetail}
        </p>
      </div>

      <div className='mt-3 flex flex-col gap-3'>
        {groupedExams.map((exam) => {
          const start = parseDate(exam.start_time);
          const end = parseDate(exam.end_time);

          const sectionLabel =
            exam.sections.length === 0
              ? null
              : `${exam.sections.length === 1 ? 'Section' : 'Sections'} ${exam.sections.join(', ')}`;

          const topLineParts = [sectionLabel].filter(Boolean) as string[];

          const bottomLineParts = [
            exam.exam.location ?? null,
            exam.exam.type ?? null,
            exam.exam.format ?? null,
          ].filter(Boolean) as string[];

          const key = exam.key;

          const dateLabel = formatDateLabel(start);
          const timeLabel = formatTimeLabel(start, end);

          const topLine = renderDetailLine(
            topLineParts,
            `${key}-top`,
            'text-sm text-gray-600 dark:text-gray-300 sm:col-start-2 sm:row-start-1'
          );
          const bottomLine = renderDetailLine(
            bottomLineParts,
            `${key}-bottom`,
            'text-sm text-gray-600 dark:text-gray-300 sm:col-start-2 sm:row-start-2'
          );

          const examIdentifier = [course.subject, course.code]
            .filter(Boolean)
            .join(' ')
            .trim();
          const summaryTitle = (
            examIdentifier
              ? `${examIdentifier} Final Exam`
              : `${course.title ?? 'Final Exam'}`
          ).trim();

          const descriptionParts = [
            course.title ? `Course: ${course.title}` : null,
            sectionLabel ? `Sections: ${exam.sections.join(', ')}` : null,
            `Date: ${dateLabel}`,
            `Time: ${timeLabel}`,
            exam.exam.location ? `Location: ${exam.exam.location}` : null,
            exam.exam.type ? `Type: ${exam.exam.type}` : null,
            exam.exam.format ? `Format: ${exam.exam.format}` : null,
            examScheduleUrl ? `Schedule: ${examScheduleUrl}` : null,
          ].filter(Boolean) as string[];

          const description =
            descriptionParts.length > 0
              ? descriptionParts.join('\n')
              : undefined;

          const filenameBase = sanitizeForFilename(
            [
              examIdentifier.replace(/\s+/g, '-') || undefined,
              'final-exam',
              currentTerm,
            ]
              .filter(Boolean)
              .join('-')
          );
          const filename = `${filenameBase || 'final-exam'}.ics`;

          const uid = `${(
            sanitizeForFilename(
              [
                course._id ?? '',
                exam.start_time ?? '',
                exam.end_time ?? '',
                currentTerm,
              ]
                .filter(Boolean)
                .join('-')
            ) ||
            sanitizeForFilename(key) ||
            'final-exam'
          ).slice(0, 64)}@mcgill.courses`;

          const calendarPayload = start
            ? {
                filename,
                events: [
                  {
                    start,
                    end,
                    summary: summaryTitle,
                    description,
                    location: exam.exam.location,
                    url: examScheduleUrl,
                    uid,
                  },
                ],
                prodId: '-//mcgill.courses//FinalExam//EN',
              }
            : null;

          const addToCalendarButton = (
            <AddToCalendarButton
              payload={calendarPayload}
              ariaLabel='Add final exam to calendar'
              title={start ? 'Add to calendar' : 'Exam date coming soon'}
              variant='ghost'
            />
          );

          const infoContent = (
            <div className='relative grid w-full gap-x-6 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]'>
              <span className='flex items-center justify-between text-sm font-medium text-gray-900 dark:text-gray-100 sm:col-start-1 sm:row-start-1'>
                {dateLabel}
              </span>
              {topLine}
              <span className='text-sm text-gray-600 dark:text-gray-300 sm:col-start-1 sm:row-start-2'>
                {timeLabel}
              </span>
              {bottomLine}

              <div className='absolute right-[-6px] top-[-4px] sm:hidden lg:block xl:hidden'>
                {addToCalendarButton}
              </div>
            </div>
          );

          return (
            <div
              key={key}
              className={twMerge(
                'flex flex-col gap-3 rounded-md border border-slate-200/70 bg-white/70 p-3 text-sm text-gray-700 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-200 sm:flex-row sm:items-start sm:gap-6',
                examScheduleUrl
                  ? 'transition-colors hover:border-slate-300 hover:bg-white dark:hover:border-neutral-600 dark:hover:bg-neutral-900'
                  : ''
              )}
            >
              <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6'>
                <div className='flex w-full sm:block'>
                  {examScheduleUrl ? (
                    <a
                      href={examScheduleUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='block w-full focus-visible:outline-none'
                    >
                      {infoContent}
                    </a>
                  ) : (
                    infoContent
                  )}
                </div>
                <div className='hidden shrink-0 items-center sm:flex sm:self-center lg:hidden xl:flex'>
                  {addToCalendarButton}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
