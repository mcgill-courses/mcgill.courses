import { ArrowLeft, ArrowRight, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

import { Layout } from '../components/layout';
import { SearchBar } from '../components/search-bar';
import { VisualSchedule } from '../components/visual-schedule';
import { api } from '../lib/api';
import {
  buildScheduleResults,
  formatScheduleMinutes,
  getBlockMeetingLabels,
  getCourseScheduleOptions,
} from '../lib/schedule-builder';
import {
  type StoredSchedule,
  readStoredSchedule,
  writeStoredSchedule,
} from '../lib/schedule-builder-storage';
import {
  type CourseData,
  getRankedCourses,
  getSearchIndex,
} from '../lib/search-index';
import type { Course } from '../lib/types';
import { getCurrentTerms, spliceCourseCode } from '../lib/utils';

const { courses, coursesIndex } = getSearchIndex();

const formatCourseCount = (count: number) =>
  count === 1 ? '1 course' : `${count} courses`;

const formatResultCount = (count: number, truncated: boolean) =>
  `${count.toLocaleString('en-US')} schedule${count === 1 ? '' : 's'}${
    truncated ? ' shown' : ''
  }`;

const formatResultTime = (value: number | null) =>
  value === null ? 'No meeting time' : formatScheduleMinutes(value);

const formatDayCount = (count: number) =>
  count === 1 ? '1 day' : `${count} days`;

const formatOptionCount = (count: number) =>
  count === 1 ? '1 section' : `${count} sections`;

export const ScheduleBuilder = () => {
  const currentTerms = useMemo(() => getCurrentTerms(), []);
  const storedSchedule = useMemo(
    () => readStoredSchedule(currentTerms),
    [currentTerms]
  );

  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [restoredSchedule, setRestoredSchedule] = useState(
    () => (storedSchedule?.selectedCourseIds.length ?? 0) === 0
  );
  const [resultIndex, setResultIndex] = useState(0);
  const [searchSelected, setSearchSelected] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedResultId, setSelectedResultId] = useState(
    storedSchedule?.selectedResultId
  );
  const [selectedTerm, setSelectedTerm] = useState(
    () => storedSchedule?.selectedTerm ?? currentTerms[0]
  );

  const candidates = useMemo(() => {
    if (!query.trim()) return [];

    const selectedCourseIds = new Set(
      selectedCourses.map((course) => course._id)
    );

    return getRankedCourses(query, courses, coursesIndex)
      .filter((course) => !selectedCourseIds.has(course._id))
      .slice(0, 6);
  }, [query, selectedCourses]);

  const build = useMemo(
    () => buildScheduleResults(selectedCourses, selectedTerm),
    [selectedCourses, selectedTerm]
  );
  const results = build.results;
  const result = results[resultIndex];

  useEffect(() => {
    const selectedCourseIds = storedSchedule?.selectedCourseIds ?? [];

    if (selectedCourseIds.length === 0) {
      setRestoredSchedule(true);
      return;
    }

    let active = true;

    Promise.all(
      selectedCourseIds.map((courseId) =>
        api.getCourseById(courseId, {
          withAverages: false,
          withReviews: false,
        })
      )
    )
      .then((payloads) => {
        if (!active) return;

        setSelectedCourses(
          payloads.flatMap((payload) =>
            payload === null ? [] : [payload.course]
          )
        );
      })
      .catch(() => {
        toast.error('Failed to restore schedule');
      })
      .finally(() => {
        if (active) setRestoredSchedule(true);
      });

    return () => {
      active = false;
    };
  }, [storedSchedule]);

  useEffect(() => {
    if (!restoredSchedule) return;

    if (results.length === 0) {
      if (resultIndex !== 0) setResultIndex(0);
      if (selectedResultId !== undefined) setSelectedResultId(undefined);
      return;
    }

    const storedIndex = selectedResultId
      ? results.findIndex((result) => result.id === selectedResultId)
      : resultIndex;
    const nextIndex =
      storedIndex === -1
        ? 0
        : Math.min(Math.max(storedIndex, 0), results.length - 1);
    const nextResultId = results[nextIndex].id;

    if (nextIndex !== resultIndex) setResultIndex(nextIndex);
    if (nextResultId !== selectedResultId) setSelectedResultId(nextResultId);
  }, [restoredSchedule, resultIndex, results, selectedResultId]);

  useEffect(() => {
    if (!restoredSchedule) return;

    const schedule: StoredSchedule = {
      selectedCourseIds: selectedCourses.map((course) => course._id),
      selectedResultId,
      selectedTerm,
    };

    writeStoredSchedule(schedule);
  }, [restoredSchedule, selectedCourses, selectedResultId, selectedTerm]);

  const addCourse = async (course: CourseData) => {
    if (selectedCourses.some((selected) => selected._id === course._id)) return;

    setLoadingCourseId(course._id);

    try {
      const payload = await api.getCourseById(course._id, {
        withAverages: false,
        withReviews: false,
      });

      if (payload === null) {
        toast.error('Course could not be found');
        return;
      }

      setSelectedCourses((previous) => [...previous, payload.course]);
      setQuery('');
      setSearchSelected(false);
    } catch {
      toast.error('Failed to fetch course schedule');
    } finally {
      setLoadingCourseId(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((previous) =>
        previous > 0 ? previous - 1 : Math.max(0, candidates.length - 1)
      );
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((previous) =>
        previous < candidates.length - 1 ? previous + 1 : 0
      );
    }

    if (event.key === 'Enter' && candidates[selectedIndex]) {
      event.preventDefault();
      addCourse(candidates[selectedIndex]);
    }
  };

  const removeCourse = (courseId: string) => {
    setSelectedCourses((previous) =>
      previous.filter((course) => course._id !== courseId)
    );
  };

  const reset = () => {
    setQuery('');
    setResultIndex(0);
    setSearchSelected(false);
    setSelectedCourses([]);
    setSelectedResultId(undefined);
    setSelectedTerm(currentTerms[0]);
  };

  const selectResultIndex = (index: number) => {
    const result = results[index];

    if (!result) return;

    setResultIndex(index);
    setSelectedResultId(result.id);
  };

  return (
    <Layout>
      <Helmet>
        <title>Schedule Builder - mcgill.courses</title>
        <meta
          name='description'
          content='Build non-conflicting McGill course schedules.'
        />
      </Helmet>

      <div className='py-7'>
        <div className='mb-7 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl dark:text-gray-100'>
              Schedule Builder
            </h1>
            <div className='mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400'>
              <span>{formatCourseCount(selectedCourses.length)}</span>
              <span>{selectedTerm}</span>
              <span>{formatResultCount(results.length, build.truncated)}</span>
            </div>
          </div>
          <button
            aria-label='Start over'
            className='inline-flex size-9 items-center justify-center rounded-md text-gray-500 ring-1 ring-slate-200 transition hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:ring-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-gray-100'
            onClick={reset}
            title='Start over'
            type='button'
          >
            <RotateCcw className='size-4' />
          </button>
        </div>

        <div className='grid gap-8 xl:grid-cols-[300px_minmax(0,1fr)]'>
          <section className='space-y-6 xl:sticky xl:top-24 xl:self-start'>
            <div>
              <div className='mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400'>
                Term
              </div>
              <div className='flex flex-wrap gap-2 xl:flex-col'>
                {currentTerms.map((term) => (
                  <button
                    className={twMerge(
                      'rounded-md px-3 py-2 text-left text-sm font-medium transition',
                      selectedTerm === term
                        ? 'bg-gray-950 text-white dark:bg-gray-100 dark:text-neutral-950'
                        : 'text-gray-600 hover:bg-white hover:text-gray-950 dark:text-gray-400 dark:hover:bg-neutral-800 dark:hover:text-gray-100'
                    )}
                    key={term}
                    onClick={() => setSelectedTerm(term)}
                    type='button'
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className='mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400'>
                Course
              </div>
              <div className='relative'>
                <SearchBar
                  handleInputChange={(value) => {
                    setQuery(value);
                    setSelectedIndex(0);
                  }}
                  inputStyle='block w-full rounded-md bg-white p-3 pl-10 text-sm text-gray-950 outline-none ring-1 ring-slate-200 transition placeholder:text-gray-400 focus:ring-red-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-neutral-700 dark:placeholder:text-neutral-500'
                  onKeyDown={handleKeyDown}
                  placeholder='Search courses'
                  searchSelected={searchSelected}
                  setSearchSelected={setSearchSelected}
                  value={query}
                />
                {searchSelected && query.trim() && (
                  <div className='absolute top-full z-30 mt-2 w-full overflow-hidden rounded-md bg-white py-1 shadow-xl ring-1 ring-slate-200 dark:bg-neutral-800 dark:ring-neutral-700'>
                    {candidates.length > 0 ? (
                      candidates.map((candidate, index) => (
                        <button
                          className={twMerge(
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition',
                            index === selectedIndex
                              ? 'bg-slate-100 text-gray-950 dark:bg-neutral-700 dark:text-gray-100'
                              : 'text-gray-700 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-neutral-700'
                          )}
                          disabled={loadingCourseId !== null}
                          key={candidate._id}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            addCourse(candidate);
                          }}
                          type='button'
                        >
                          <Plus className='size-4 shrink-0 text-gray-400' />
                          <span className='min-w-0'>
                            <span className='block truncate font-medium'>
                              {spliceCourseCode(candidate._id, ' ')}
                            </span>
                            <span className='block truncate text-xs text-gray-500 dark:text-gray-400'>
                              {candidate.title}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className='px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400'>
                        No courses found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className='mb-2 flex items-center justify-between gap-3'>
                <div className='text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400'>
                  Courses
                </div>
                <div className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                  {selectedCourses.length}
                </div>
              </div>
              {selectedCourses.length > 0 ? (
                <div className='divide-y divide-slate-200 overflow-hidden rounded-md bg-white/70 ring-1 ring-slate-200 dark:divide-neutral-800 dark:bg-neutral-900/40 dark:ring-neutral-800'>
                  {selectedCourses.map((course) => {
                    const options = getCourseScheduleOptions(
                      course,
                      selectedTerm
                    );

                    return (
                      <div className='p-3' key={course._id}>
                        <div className='flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <div className='truncate text-sm font-semibold text-gray-950 dark:text-gray-100'>
                              {spliceCourseCode(course._id, ' ')}
                            </div>
                            <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                              {course.title}
                            </div>
                            <div className='mt-2 text-xs font-medium text-gray-500 dark:text-gray-400'>
                              {formatOptionCount(options.length)}
                            </div>
                          </div>
                          <button
                            aria-label={`Remove ${course._id}`}
                            className='rounded-md p-1.5 text-gray-400 transition hover:bg-slate-100 hover:text-red-600 dark:hover:bg-neutral-800 dark:hover:text-red-300'
                            onClick={() => removeCourse(course._id)}
                            title={`Remove ${course._id}`}
                            type='button'
                          >
                            <Trash2 className='size-4' />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className='border-t border-slate-200 py-4 text-sm text-gray-500 dark:border-neutral-800 dark:text-gray-400'>
                  No courses selected
                </div>
              )}
            </div>
          </section>

          <section className='min-w-0'>
            <div className='mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between dark:border-neutral-800'>
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
                <span className='font-semibold text-gray-950 dark:text-gray-100'>
                  {formatResultCount(results.length, build.truncated)}
                </span>
                {result && (
                  <span className='text-gray-500 dark:text-gray-400'>
                    {formatResultTime(result.earliestStart)} to{' '}
                    {formatResultTime(result.latestEnd)} ·{' '}
                    {formatDayCount(result.dayCount)}
                  </span>
                )}
              </div>
              <div className='flex items-center overflow-hidden rounded-md bg-white ring-1 ring-slate-200 dark:bg-neutral-800 dark:ring-neutral-700'>
                <button
                  className='inline-flex size-9 items-center justify-center text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-200 dark:hover:bg-neutral-700 dark:disabled:text-gray-600'
                  disabled={resultIndex === 0}
                  onClick={() => selectResultIndex(resultIndex - 1)}
                  title='Previous schedule'
                  type='button'
                >
                  <ArrowLeft className='size-4' />
                </button>
                <div className='min-w-20 border-x border-slate-200 px-3 py-2 text-center text-sm font-medium text-gray-700 dark:border-neutral-700 dark:text-gray-200'>
                  {results.length > 0 ? resultIndex + 1 : 0} / {results.length}
                </div>
                <button
                  className='inline-flex size-9 items-center justify-center text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-200 dark:hover:bg-neutral-700 dark:disabled:text-gray-600'
                  disabled={resultIndex >= results.length - 1}
                  onClick={() => selectResultIndex(resultIndex + 1)}
                  title='Next schedule'
                  type='button'
                >
                  <ArrowRight className='size-4' />
                </button>
              </div>
            </div>

            {selectedCourses.length === 0 ? (
              <div className='flex min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white/60 text-sm font-medium text-gray-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-gray-400'>
                No courses selected
              </div>
            ) : build.missingCourses.length > 0 ? (
              <div className='rounded-md border-l-2 border-amber-400 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
                No sections in {selectedTerm}:{' '}
                {build.missingCourses.map((course) => course._id).join(', ')}
              </div>
            ) : result ? (
              <div className='space-y-4'>
                <VisualSchedule blocks={result.blocks} />
                <div className='overflow-hidden rounded-md bg-white/70 ring-1 ring-slate-200 dark:bg-neutral-900/40 dark:ring-neutral-800'>
                  <div className='divide-y divide-slate-100 dark:divide-neutral-800'>
                    {result.blocks.map((block) => (
                      <div
                        className='grid gap-x-4 gap-y-2 px-3 py-3 text-sm md:grid-cols-[120px_minmax(0,1fr)_minmax(180px,auto)] md:items-center'
                        key={`${block.courseId}-${block.display}-${block.crn}`}
                      >
                        <div className='min-w-0'>
                          <div className='font-semibold text-gray-950 dark:text-gray-100'>
                            {block.courseId}
                          </div>
                          <div className='text-xs text-gray-500 dark:text-gray-400'>
                            {block.display || 'Section'}
                          </div>
                        </div>
                        <div className='flex flex-wrap gap-1.5'>
                          {getBlockMeetingLabels(block).map((label) => (
                            <span
                              className='rounded-sm bg-slate-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-neutral-800 dark:text-gray-300'
                              key={label}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                        <div className='text-xs text-gray-500 md:text-right dark:text-gray-400'>
                          {block.location || block.campus || 'Location TBA'}
                          {' · '}
                          {block.crn ? `CRN ${block.crn}` : 'CRN unavailable'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className='flex min-h-[520px] items-center justify-center rounded-md bg-white/70 p-6 text-center text-sm font-medium text-gray-500 ring-1 ring-slate-200 dark:bg-neutral-900/40 dark:text-gray-400 dark:ring-neutral-800'>
                No non-conflicting schedules found
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
};
