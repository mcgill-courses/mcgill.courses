import { Dot } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import finalExams from '../assets/final-exams.json';
import { sanitizeForFilename } from '../lib/calendar';
import type { Course, FinalExam } from '../lib/types';
import { getCurrentTerm } from '../lib/utils';
import { AddToCalendarButton } from './add-to-calendar-button';

type GroupedExam = {
  key: string;
  startTime: string;
  endTime: string;
  format: string;
  type: string;
  location?: string;
  sections: string[];
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  })
    .format(date)
    .toUpperCase()
    .replace(':00', '')
    .replace(' ', '');

const sortExams = (exams: FinalExam[]) =>
  exams.slice().sort((a, b) => {
    const cmp = a.startTime.localeCompare(b.startTime);
    if (cmp !== 0) return cmp;
    return a.section.localeCompare(b.section, undefined, { numeric: true });
  });

const groupExams = (exams: FinalExam[]): GroupedExam[] => {
  const grouped = new Map<string, GroupedExam>();

  for (const exam of exams) {
    const key = [
      exam.id,
      exam.startTime,
      exam.endTime,
      exam.location ?? '',
      exam.type,
      exam.format,
    ].join('|');

    const existing = grouped.get(key);

    if (existing) {
      existing.sections.push(exam.section);
    } else {
      grouped.set(key, {
        key,
        startTime: exam.startTime,
        endTime: exam.endTime,
        format: exam.format,
        type: exam.type,
        location: exam.location,
        sections: [exam.section],
      });
    }
  }

  for (const exam of grouped.values()) {
    exam.sections.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }

  return Array.from(grouped.values());
};

const DetailLine = ({
  parts,
  className,
}: {
  parts: (string | undefined)[];
  className?: string;
}) => {
  const filtered = parts.filter(Boolean) as string[];

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div className={twMerge('flex flex-wrap items-center', className)}>
      {filtered.map((part, index) => (
        <span key={index} className='flex items-center'>
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

  if (finalExams.term !== currentTerm) {
    return null;
  }

  const exams = finalExams.exams.filter((exam) => exam.id === course._id);

  if (exams.length === 0) {
    return null;
  }

  const groupedExams = groupExams(sortExams(exams));

  const sectionCount = new Set(exams.map((exam) => exam.section)).size;

  const examScheduleUrl = `${finalExams.url}#:~:text=${encodeURIComponent(`${course.subject} ${course.code}`)}`;

  return (
    <div
      className={twMerge(
        'rounded-md bg-slate-50 p-4 shadow-sm dark:bg-neutral-800',
        className
      )}
    >
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <div>
          <p className='text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400'>
            Final Exam
          </p>
          <p className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {currentTerm}
          </p>
        </div>
        <p className='text-sm text-gray-600 dark:text-gray-300'>
          {sectionCount} {sectionCount === 1 ? 'section' : 'sections'} scheduled
        </p>
      </div>

      <div className='mt-3 flex flex-col gap-3'>
        {groupedExams.map((exam) => {
          const start = new Date(exam.startTime);
          const end = new Date(exam.endTime);

          const dateLabel = formatDate(start);
          const timeLabel = `${formatTime(start)} - ${formatTime(end)}`;
          const sectionLabel = `${exam.sections.length === 1 ? 'Section' : 'Sections'} ${exam.sections.join(', ')}`;

          const examId = `${course.subject} ${course.code}`;

          const description = [
            `Course: ${course.title}`,
            `Sections: ${exam.sections.join(', ')}`,
            `Date: ${dateLabel}`,
            `Time: ${timeLabel}`,
            exam.location ? `Location: ${exam.location}` : null,
            `Type: ${exam.type}`,
            `Format: ${exam.format}`,
            `Schedule: ${examScheduleUrl}`,
          ]
            .filter(Boolean)
            .join('\n');

          const filename = `${sanitizeForFilename(`${examId}-final-exam-${currentTerm}`)}.ics`;

          const uid = `${sanitizeForFilename(`${course._id}-${exam.startTime}-${exam.endTime}-${currentTerm}`).slice(0, 64)}@mcgill.courses`;

          const calendarPayload = {
            filename,
            events: [
              {
                start,
                end,
                summary: `${examId} Final Exam`,
                description,
                location: exam.location,
                url: examScheduleUrl,
                uid,
              },
            ],
            prodId: '-//mcgill.courses//FinalExam//EN',
          };

          const addToCalendarButton = (
            <AddToCalendarButton
              payload={calendarPayload}
              ariaLabel='Add final exam to calendar'
              title='Add to calendar'
              variant='ghost'
            />
          );

          const infoContent = (
            <div className='relative grid w-full gap-x-6 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]'>
              <span className='flex items-center justify-between text-sm font-medium text-gray-900 sm:col-start-1 sm:row-start-1 dark:text-gray-100'>
                {dateLabel}
              </span>
              <DetailLine
                parts={[sectionLabel]}
                className='text-sm text-gray-600 sm:col-start-2 sm:row-start-1 dark:text-gray-300'
              />
              <span className='text-sm text-gray-600 sm:col-start-1 sm:row-start-2 dark:text-gray-300'>
                {timeLabel}
              </span>
              <DetailLine
                parts={[exam.location, exam.type, exam.format]}
                className='text-sm text-gray-600 sm:col-start-2 sm:row-start-2 dark:text-gray-300'
              />
              <div className='absolute top-[-4px] right-[-6px] sm:hidden lg:block xl:hidden'>
                {addToCalendarButton}
              </div>
            </div>
          );

          return (
            <div
              key={exam.key}
              className='flex flex-col gap-3 rounded-md border border-slate-200/70 bg-white/70 p-3 text-sm text-gray-700 transition-colors hover:border-slate-300 hover:bg-white sm:flex-row sm:items-start sm:gap-6 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900'
            >
              <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6'>
                <div className='flex w-full sm:block'>
                  <a
                    href={examScheduleUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='block w-full focus-visible:outline-none'
                  >
                    {infoContent}
                  </a>
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
