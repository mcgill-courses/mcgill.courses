import { ArrowLeft, ArrowRight, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';

import courseTerms from '../assets/course-terms.json';
import { Autocomplete } from '../components/autocomplete';
import { CourseSearchBar } from '../components/course-search-bar';
import { Layout } from '../components/layout';
import { VisualSchedule } from '../components/visual-schedule';
import { api } from '../lib/api';
import {
  type BuilderBlock,
  DAY_LABELS,
  type PinnedScheduleOptions,
  buildScheduleResults,
  formatScheduleMinutes,
  getBlockMeetingLabels,
  getCourseScheduleOptions,
  getScheduleConflicts,
} from '../lib/schedule-builder';
import {
  type StoredSchedule,
  readStoredSchedule,
  writeStoredSchedule,
} from '../lib/schedule-builder-storage';
import {
  type CourseData,
  type SearchResults,
  getSearchIndex,
  updateSearchResults,
} from '../lib/search-index';
import type { Course } from '../lib/types';
import { getCurrentTerms, pluralize, spliceCourseCode } from '../lib/utils';
import { Loading } from './loading';

const { courses, instructors, coursesIndex, instructorsIndex } =
  getSearchIndex();
const courseTermsById = courseTerms as Record<string, string[]>;

const formatResultCount = (count: number, truncated: boolean) =>
  `${pluralize(count, 'schedule')}${truncated ? ' shown' : ''}`;

const formatResultTime = (value: number | null) =>
  value === null ? 'No meeting time' : formatScheduleMinutes(value);

export const ScheduleBuilder = () => {
  const currentTerms = useMemo(() => getCurrentTerms(), []);
  const storedSchedule = useMemo(
    () => readStoredSchedule(currentTerms),
    [currentTerms]
  );

  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults>({
    query: '',
    courses: [],
    instructors: [],
  });
  const [restoredSchedule, setRestoredSchedule] = useState(
    () => (storedSchedule?.selectedCourseIds.length ?? 0) === 0
  );
  const [resultIndex, setResultIndex] = useState(0);
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [selectedResultId, setSelectedResultId] = useState(
    storedSchedule?.selectedResultId
  );
  const [selectedTerm, setSelectedTerm] = useState(
    () => storedSchedule?.selectedTerm ?? currentTerms[0]
  );
  const [pinnedOptions, setPinnedOptions] = useState<PinnedScheduleOptions>(
    () => storedSchedule?.pinnedOptions ?? {}
  );
  const [allowConflicts, setAllowConflicts] = useState(
    () => storedSchedule?.allowConflicts ?? false
  );

  const visibleSearchResults = useMemo(() => {
    const selectedCourseIds = new Set(
      selectedCourses.map((course) => course._id)
    );

    return {
      query: searchResults.query,
      courses: searchResults.courses
        .filter(
          (course) =>
            !selectedCourseIds.has(course._id) &&
            courseTermsById[course._id]?.includes(selectedTerm)
        )
        .slice(0, 6),
      instructors: [],
    };
  }, [searchResults, selectedCourses, selectedTerm]);

  const build = useMemo(
    () =>
      buildScheduleResults(selectedCourses, selectedTerm, {
        allowConflicts,
        pinnedOptions,
      }),
    [allowConflicts, pinnedOptions, selectedCourses, selectedTerm]
  );
  const conflicts = useMemo(
    () => getScheduleConflicts(selectedCourses, selectedTerm),
    [selectedCourses, selectedTerm]
  );
  const results = build.results;
  const activeResultIndex =
    results.length === 0
      ? 0
      : Math.min(Math.max(resultIndex, 0), results.length - 1);
  const result = results[activeResultIndex];
  const isRestoringSchedule = !restoredSchedule;
  const resultCountLabel = formatResultCount(results.length, build.truncated);
  const pinnedCourseIds = useMemo(
    () =>
      result?.options
        .filter((option) => pinnedOptions[option.courseId] === option.id)
        .map((option) => option.courseId) ?? [],
    [pinnedOptions, result]
  );

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
      allowConflicts,
      pinnedOptions,
      selectedCourseIds: selectedCourses.map((course) => course._id),
      selectedResultId,
      selectedTerm,
    };

    writeStoredSchedule(schedule);
  }, [
    allowConflicts,
    pinnedOptions,
    restoredSchedule,
    selectedCourses,
    selectedResultId,
    selectedTerm,
  ]);

  useEffect(() => {
    if (!restoredSchedule) return;

    const selectedCourseIds = new Set(
      selectedCourses.map((course) => course._id)
    );

    setPinnedOptions((previous) => {
      const entries = Object.entries(previous).filter(([courseId]) =>
        selectedCourseIds.has(courseId)
      );

      if (entries.length === Object.keys(previous).length) return previous;

      return Object.fromEntries(entries);
    });
  }, [restoredSchedule, selectedCourses]);

  const addCourse = async (course: CourseData) => {
    if (selectedCourses.some((selected) => selected._id === course._id)) {
      return false;
    }

    setLoadingCourseId(course._id);

    try {
      const payload = await api.getCourseById(course._id, {
        withAverages: false,
        withReviews: false,
      });

      if (payload === null) {
        toast.error('Course could not be found');
        return false;
      }

      setSelectedCourses((previous) => [...previous, payload.course]);
      return true;
    } catch {
      toast.error('Failed to fetch course schedule');
      return false;
    } finally {
      setLoadingCourseId(null);
    }
  };

  const handleInputChange = (query: string) => {
    updateSearchResults(
      query,
      courses,
      instructors,
      coursesIndex,
      instructorsIndex,
      setSearchResults,
      {
        courseLimit: 150,
        courseSearchLimit: 250,
        instructorLimit: 0,
      }
    );
  };

  const resetSearch = () =>
    setSearchResults({
      query: '',
      courses: [],
      instructors: [],
    });

  const removeCourse = (courseId: string) => {
    setSelectedCourses((previous) =>
      previous.filter((course) => course._id !== courseId)
    );
    setPinnedOptions((previous) => {
      const next = { ...previous };
      delete next[courseId];
      return next;
    });
  };

  const reset = () => {
    resetSearch();
    setAllowConflicts(false);
    setPinnedOptions({});
    setResultIndex(0);
    setSelectedCourses([]);
    setSelectedResultId(undefined);
    setSelectedTerm(currentTerms[0]);
  };

  const selectResultIndex = (index: number) => {
    if (results.length === 0) return;

    const indexWithinResults =
      ((index % results.length) + results.length) % results.length;
    const result = results[indexWithinResults];

    setResultIndex(indexWithinResults);
    setSelectedResultId(result.id);
  };

  const togglePinnedBlock = (block: BuilderBlock) => {
    if (!result) return;

    const option = result.options.find(
      (option) => option.courseId === block.courseId
    );

    if (!option) return;

    setPinnedOptions((previous) => {
      const next = { ...previous };

      if (next[option.courseId] === option.id) {
        delete next[option.courseId];
      } else {
        next[option.courseId] = option.id;
      }

      return next;
    });
  };

  if (isRestoringSchedule) {
    return <Loading />;
  }

  return (
    <Layout>
      <Helmet>
        <title>Schedule Builder - mcgill.courses</title>
        <meta name='description' content='Build McGill course schedules.' />
      </Helmet>

      <div className='py-7'>
        <div className='mb-6'>
          <h1 className='text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl dark:text-gray-100'>
            Schedule Builder
          </h1>
        </div>

        <div className='grid gap-x-8 gap-y-6 xl:grid-cols-[300px_minmax(0,1fr)]'>
          <section>
            <div className='mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400'>
              Term
            </div>
            <div className='relative z-20'>
              <Autocomplete
                options={currentTerms}
                setValue={(term) => {
                  if (term !== selectedTerm) {
                    setPinnedOptions({});
                  }

                  setSelectedTerm(term);
                }}
                value={selectedTerm}
              />
            </div>
          </section>

          <section>
            <div className='mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400'>
              Options
            </div>
            <div className='flex min-h-10 items-center justify-between gap-3'>
              <label className='flex cursor-pointer items-center gap-2 rounded-xs px-3 py-2 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-950 dark:text-gray-400 dark:hover:bg-neutral-800 dark:hover:text-gray-100'>
                <input
                  checked={allowConflicts}
                  className='size-4 cursor-pointer rounded border-slate-300 text-red-600 focus:ring-red-500 dark:border-neutral-700 dark:bg-neutral-900'
                  onChange={(event) => setAllowConflicts(event.target.checked)}
                  type='checkbox'
                />
                <span>Allow time conflicts</span>
              </label>
              <button
                aria-label='Start over'
                className='inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-500 ring-1 ring-slate-200 hover:bg-white hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-gray-400 dark:ring-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-gray-100'
                onClick={reset}
                title='Start over'
                type='button'
              >
                <RotateCcw className='size-4' />
              </button>
            </div>
          </section>

          <section className='space-y-6 xl:sticky xl:top-24 xl:self-start'>
            <div>
              <div className='mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400'>
                Search
              </div>
              <CourseSearchBar
                handleInputChange={handleInputChange}
                inputClassName='lg:min-w-0'
                onCourseSelect={(course) => {
                  if (loadingCourseId !== null) return false;

                  return addCourse(course);
                }}
                onResultClick={resetSearch}
                placeholder='Search courses'
                results={visibleSearchResults}
                showFocusBorder={false}
                showExploreButton={false}
                showInstructors={false}
              />
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
                    const selectedOption = result?.options.find(
                      (option) => option.courseId === course._id
                    );
                    const pinned =
                      selectedOption !== undefined &&
                      pinnedOptions[course._id] === selectedOption.id;

                    return (
                      <div
                        className='group p-3 hover:bg-white dark:hover:bg-neutral-900/60'
                        key={course._id}
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <div className='truncate text-sm font-semibold text-gray-950 group-hover:text-red-700 dark:text-gray-100 dark:group-hover:text-red-300'>
                              {spliceCourseCode(course._id, ' ')}
                            </div>
                            <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                              {course.title}
                            </div>
                            {selectedOption ? (
                              <div className='mt-2 space-y-1'>
                                {selectedOption.blocks.map(
                                  (block, blockIndex) => (
                                    <div
                                      className='space-y-0.5'
                                      key={`${block.display}-${block.crn}-${blockIndex}`}
                                    >
                                      <div className='flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300'>
                                        <span>
                                          {block.display || 'Section'}
                                        </span>
                                        {pinned && blockIndex === 0 && (
                                          <span className='rounded-sm bg-gray-900 px-1.5 py-0.5 text-[10px] text-white dark:bg-gray-100 dark:text-neutral-950'>
                                            Pinned
                                          </span>
                                        )}
                                      </div>
                                      {getBlockMeetingLabels(block).map(
                                        (label) => (
                                          <div
                                            className='truncate text-[11px] text-gray-500 dark:text-gray-400'
                                            key={label}
                                          >
                                            {label}
                                          </div>
                                        )
                                      )}
                                      <div className='truncate text-[11px] text-gray-500 dark:text-gray-400'>
                                        {block.location ||
                                          block.campus ||
                                          'Location TBA'}
                                      </div>
                                      <div className='truncate text-[11px] text-gray-500 dark:text-gray-400'>
                                        {block.crn
                                          ? `CRN ${block.crn}`
                                          : 'CRN unavailable'}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className='mt-2 text-xs font-medium text-gray-500 dark:text-gray-400'>
                                {pluralize(options.length, 'section')}
                              </div>
                            )}
                          </div>
                          <button
                            aria-label={`Remove ${course._id}`}
                            className='cursor-pointer rounded-md p-1.5 text-gray-400 hover:bg-slate-100 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:hover:bg-neutral-800 dark:hover:text-red-300'
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
            <div className='mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400'>
              Schedule
            </div>
            <div className='mb-4 flex flex-col gap-3 border-slate-200 pb-4 md:flex-row md:items-center md:justify-between dark:border-neutral-800'>
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
                <span className='font-semibold text-gray-950 dark:text-gray-100'>
                  {resultCountLabel}
                </span>
                {result && (
                  <span className='text-gray-500 dark:text-gray-400'>
                    {formatResultTime(result.earliestStart)} to{' '}
                    {formatResultTime(result.latestEnd)} ·{' '}
                    {pluralize(result.dayCount, 'day', 'days')}
                  </span>
                )}
              </div>
              <div className='flex items-center overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200 dark:bg-neutral-800 dark:ring-neutral-700'>
                <button
                  aria-label='Previous schedule'
                  className='inline-flex size-9 cursor-pointer items-center justify-center text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-200 dark:hover:bg-neutral-700 dark:disabled:text-gray-600'
                  disabled={results.length === 0}
                  onClick={() => selectResultIndex(activeResultIndex - 1)}
                  title='Previous schedule'
                  type='button'
                >
                  <ArrowLeft className='size-4' />
                </button>
                <div
                  aria-live='polite'
                  className='min-w-20 border-x border-slate-200 px-3 py-2 text-center text-sm font-medium text-gray-700 transition-colors dark:border-neutral-700 dark:text-gray-200'
                >
                  {results.length > 0 ? activeResultIndex + 1 : 0} /{' '}
                  {results.length}
                </div>
                <button
                  aria-label='Next schedule'
                  className='inline-flex size-9 cursor-pointer items-center justify-center text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-gray-300 dark:text-gray-200 dark:hover:bg-neutral-700 dark:disabled:text-gray-600'
                  disabled={results.length === 0}
                  onClick={() => selectResultIndex(activeResultIndex + 1)}
                  title='Next schedule'
                  type='button'
                >
                  <ArrowRight className='size-4' />
                </button>
              </div>
            </div>

            {selectedCourses.length === 0 ? (
              <div className='flex min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white/60 text-sm font-medium text-gray-500 shadow-sm transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-gray-400'>
                No courses selected
              </div>
            ) : build.missingCourses.length > 0 ? (
              <div className='rounded-md border-l-2 border-amber-400 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 shadow-sm ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900/40'>
                No sections in {selectedTerm}:{' '}
                {build.missingCourses.map((course) => course._id).join(', ')}
              </div>
            ) : result ? (
              <div className='space-y-3'>
                <VisualSchedule
                  blocks={result.blocks}
                  onBlockClick={togglePinnedBlock}
                  pinnedCourseIds={pinnedCourseIds}
                />
              </div>
            ) : conflicts.length > 0 ? (
              <div className='overflow-hidden rounded-md bg-white/70 shadow-sm ring-1 ring-slate-200 dark:bg-neutral-900/40 dark:ring-neutral-800'>
                <div className='border-b border-slate-100 px-4 py-3 dark:border-neutral-800'>
                  <div className='text-sm font-semibold text-gray-950 dark:text-gray-100'>
                    No non-conflicting schedules found
                  </div>
                  <div className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                    {pluralize(conflicts.length, 'overlap')} in {selectedTerm}
                  </div>
                </div>
                <div className='divide-y divide-slate-100 dark:divide-neutral-800'>
                  {conflicts.slice(0, 8).map((conflict) => {
                    const time = `${DAY_LABELS[conflict.day] ?? conflict.day} · ${formatScheduleMinutes(conflict.start)} - ${formatScheduleMinutes(conflict.end)}`;
                    const left = `${spliceCourseCode(
                      conflict.left.courseId,
                      ' '
                    )} ${conflict.left.display || 'Section'}`;
                    const right = `${spliceCourseCode(
                      conflict.right.courseId,
                      ' '
                    )} ${conflict.right.display || 'Section'}`;

                    return (
                      <div
                        className='grid gap-2 px-4 py-3 text-sm transition-colors duration-150 hover:bg-slate-50/80 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] md:items-center dark:hover:bg-neutral-800/50'
                        key={`${left}-${right}-${conflict.day}-${conflict.start}-${conflict.end}`}
                      >
                        <div className='min-w-0'>
                          <div className='truncate font-semibold text-gray-950 dark:text-gray-100'>
                            {left}
                          </div>
                          <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                            {conflict.left.location ||
                              conflict.left.campus ||
                              'Location TBA'}
                          </div>
                        </div>
                        <div className='rounded-sm bg-amber-50 px-2 py-1 text-center text-xs font-medium text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900/60'>
                          {time}
                        </div>
                        <div className='min-w-0 md:text-right'>
                          <div className='truncate font-semibold text-gray-950 dark:text-gray-100'>
                            {right}
                          </div>
                          <div className='truncate text-xs text-gray-500 dark:text-gray-400'>
                            {conflict.right.location ||
                              conflict.right.campus ||
                              'Location TBA'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {conflicts.length > 8 && (
                  <div className='border-t border-slate-100 px-4 py-3 text-sm font-medium text-gray-500 dark:border-neutral-800 dark:text-gray-400'>
                    {pluralize(conflicts.length - 8, 'more overlap')}
                  </div>
                )}
              </div>
            ) : (
              <div className='flex min-h-[520px] items-center justify-center rounded-md bg-white/70 p-6 text-center text-sm font-medium text-gray-500 shadow-sm ring-1 ring-slate-200 dark:bg-neutral-900/40 dark:text-gray-400 dark:ring-neutral-800'>
                No non-conflicting schedules found
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
};
