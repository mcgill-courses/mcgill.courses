import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

import { CourseSearchBar } from '../components/course-search-bar';
import { Layout } from '../components/layout';
import {
  type SearchResults,
  getSearchIndex,
  updateSearchResults,
} from '../lib/search-index';

const { courses, instructors, coursesIndex, instructorsIndex } =
  getSearchIndex();

const scheduleBuilderBannerStorageKey =
  'mcgill.courses.schedule-builder-banner-seen';

const hasSeenScheduleBuilderBanner = () => {
  if (typeof window === 'undefined') return true;

  try {
    return (
      window.localStorage.getItem(scheduleBuilderBannerStorageKey) === 'true'
    );
  } catch {
    return true;
  }
};

const markScheduleBuilderBannerSeen = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(scheduleBuilderBannerStorageKey, 'true');
  } catch {
    return;
  }
};

export const Home = () => {
  const searchBarInputRef = useRef<HTMLInputElement>(null);

  const [results, setResults] = useState<SearchResults>({
    query: '',
    courses: [],
    instructors: [],
  });

  const [showScheduleBuilderBanner] = useState(
    () => !hasSeenScheduleBuilderBanner()
  );

  useEffect(() => {
    const isDesktopScreen = window.innerWidth >= 1024;

    if (isDesktopScreen) {
      searchBarInputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (showScheduleBuilderBanner) {
      markScheduleBuilderBannerSeen();
    }
  }, [showScheduleBuilderBanner]);

  const handleInputChange = (query: string) => {
    updateSearchResults(
      query,
      courses,
      instructors,
      coursesIndex,
      instructorsIndex,
      setResults
    );
  };

  return (
    <Layout>
      <Helmet>
        <title>mcgill.courses</title>
        <meta
          name='description'
          content='Explore thousands of course and professor reviews from McGill students.'
        />
      </Helmet>

      <div className='relative isolate px-6 pt-14 lg:px-8'>
        <div className='mx-auto max-w-2xl py-8'>
          {showScheduleBuilderBanner ? (
            <Link
              to='/schedule-builder'
              aria-label='New schedule builder'
              className='group relative mx-auto mb-8 flex w-fit max-w-full items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-left shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:ring-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:bg-neutral-800/80 dark:ring-neutral-700 dark:hover:bg-neutral-800 dark:hover:ring-neutral-600'
            >
              <span
                className='schedule-builder-banner-border pointer-events-none absolute inset-0 rounded-md border border-red-300/70 dark:border-red-800/80'
                aria-hidden='true'
              />
              <span className='relative flex min-w-0 flex-1 items-center gap-2 text-sm whitespace-nowrap'>
                <span className='rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300'>
                  New
                </span>
                <span className='min-w-0 truncate font-semibold text-gray-950 dark:text-gray-100'>
                  Schedule Builder
                </span>
              </span>
              <span className='relative flex shrink-0 items-center gap-1 text-sm font-medium text-red-700 transition group-hover:text-red-800 dark:text-red-300 dark:group-hover:text-red-200'>
                Try it
                <ArrowRight
                  className='size-4 transition group-hover:translate-x-0.5'
                  aria-hidden='true'
                />
              </span>
            </Link>
          ) : null}
          <div className='flex flex-col gap-10 text-center'>
            <h1 className='text-left text-3xl font-bold tracking-tight text-gray-900 md:text-5xl dark:text-gray-200'>
              Explore thousands of course and professor reviews from McGill
              students
            </h1>
            <div className='flex flex-col gap-6 text-center'>
              <CourseSearchBar
                results={results}
                handleInputChange={handleInputChange}
                inputRef={searchBarInputRef}
              />
              <Link
                to={`/explore`}
                className='mx-auto cursor-pointer text-sm text-gray-500 underline underline-offset-4 hover:text-gray-400 md:text-base dark:text-gray-400 dark:hover:text-gray-500'
              >
                or explore all courses{' '}
                <span aria-hidden='true'>&rarr;</span>{' '}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
