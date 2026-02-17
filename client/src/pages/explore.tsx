import { Fragment, useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import InfiniteScroll from 'react-infinite-scroll-component';
import { toast } from 'sonner';

import { CourseCard } from '../components/course-card';
import { ExploreFilter, SortByType } from '../components/explore-filter';
import { FilterToggle } from '../components/filter-toggle';
import { JumpToTopButton } from '../components/jump-to-top-button';
import { Layout } from '../components/layout';
import { SearchBar } from '../components/search-bar';
import { Skeleton } from '../components/skeleton';
import { Spinner } from '../components/spinner';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { useExploreFilterState } from '../hooks/use-explore-filter-state';
import { api } from '../lib/api';
import type { Course, CourseFilter } from '../lib/types';
import { CourseSortType } from '../lib/types';
import { formatTerm, getCurrentTerms } from '../lib/utils';

const COURSE_LIMIT = 20;

export const Explore = () => {
  const [courseCount, setCourseCount] = useState<number | undefined>(undefined);
  const [courses, setCourses] = useState<Course[] | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(COURSE_LIMIT);
  const [query, setQuery] = useState<string>('');
  const [searchSelected, setSearchSelected] = useState<boolean>(false);

  const currentTerms = getCurrentTerms().map(formatTerm);
  const debouncedQuery = useDebouncedValue(query, 250);

  const { selectedSubjects, selectedLevels, selectedTerms, sortBy } =
    useExploreFilterState();

  const orUndefined = (arr: string[]) => (arr.length === 0 ? undefined : arr);

  const getSortFields = useCallback(
    (
      sort: SortByType
    ): { sortReverse: boolean; sortType: CourseSortType } | undefined => {
      switch (sort) {
        case '':
          return undefined;
        case 'Highest Rating':
          return { sortReverse: true, sortType: CourseSortType.Rating };
        case 'Lowest Rating':
          return { sortReverse: false, sortType: CourseSortType.Rating };
        case 'Hardest':
          return { sortReverse: true, sortType: CourseSortType.Difficulty };
        case 'Easiest':
          return { sortReverse: false, sortType: CourseSortType.Difficulty };
        case 'Most Reviews':
          return { sortReverse: true, sortType: CourseSortType.ReviewCount };
        case 'Least Reviews':
          return { sortReverse: false, sortType: CourseSortType.ReviewCount };
      }
    },
    [sortBy]
  );

  const sortFields = getSortFields(sortBy);

  const filters: CourseFilter = {
    levels: orUndefined(selectedLevels.map((level) => level.charAt(0))),
    query: debouncedQuery === '' ? undefined : debouncedQuery,
    sortReverse: sortFields?.sortReverse,
    sortType: sortFields?.sortType,
    subjects: orUndefined(selectedSubjects),
    terms: orUndefined(
      selectedTerms.map(
        (term) =>
          currentTerms.filter(
            (currentTerm) => currentTerm.split(' ')[0] === term
          )[0]
      )
    ),
  };

  useEffect(() => {
    api
      .getCourses(COURSE_LIMIT, 0, true, filters)
      .then((data) => {
        setCourses(data.courses);
        setCourseCount(data.courseCount);
      })
      .catch(() => {
        toast.error('Failed to fetch courses, please try again later');
      });
    setHasMore(true);
    setOffset(COURSE_LIMIT);
  }, [selectedSubjects, selectedLevels, selectedTerms, sortBy, debouncedQuery]);

  const fetchMore = async () => {
    const batch = await api.getCourses(COURSE_LIMIT, offset, false, filters);

    if (batch.courses.length === 0) {
      setHasMore(false);
    } else {
      const newCourses = courses
        ? courses.concat(batch.courses)
        : batch.courses;
      setCourses(newCourses);
      setOffset(offset + COURSE_LIMIT);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Explore - mcgill.courses</title>
        <meta
          name='description'
          content='Check out information and reviews about all courses offered by McGill University.'
        />

        <meta property='og:type' content='website' />
        <meta property='og:url' content={`https://mcgill.courses/explore`} />
        <meta property='og:title' content={`Explore - mcgill.courses`} />
        <meta
          property='og:description'
          content='Check out information and reviews about all courses offered by McGill University.'
        />

        <meta
          property='twitter:url'
          content={`https://mcgill.courses/explore`}
        />
        <meta property='twitter:title' content={`Explore - mcgill.courses`} />
        <meta
          property='twitter:description'
          content='Check out information and reviews about all courses offered by McGill University.'
        />
      </Helmet>

      <div className='flex flex-col items-center py-8'>
        <div className='mb-16'>
          <h1 className='text-center text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-gray-200'>
            Explore all courses
          </h1>
          <p className='mt-2 text-center text-sm text-gray-600 md:text-base dark:text-gray-400'>
            Check out information and reviews about all{' '}
            {courseCount?.toLocaleString('en-us')} courses offered by McGill
            University.
          </p>
        </div>
        <div className='relative flex w-full max-w-xl flex-col lg:max-w-6xl lg:flex-row lg:justify-center'>
          <div className='lg:hidden'>
            <FilterToggle>
              <ExploreFilter variant='mobile' />
            </FilterToggle>
          </div>
          <div className='lg:flex-1'>
            <InfiniteScroll
              dataLength={courses?.length || 0}
              hasMore={hasMore}
              loader={
                (courses?.length || 0) >= 20 &&
                hasMore && (
                  <div className='mt-4 text-center'>
                    <Spinner />
                  </div>
                )
              }
              next={fetchMore}
              style={{ overflowY: 'hidden' }}
            >
              <div className='ml-auto flex w-full max-w-xl flex-col'>
                {courses ? (
                  <Fragment>
                    <SearchBar
                      handleInputChange={(value) => setQuery(value)}
                      iconStyle='mt-2 lg:mt-0'
                      inputStyle='block rounded-lg w-full bg-slate-200 p-3 pr-5 pl-10 text-sm text-black outline-none dark:border-neutral-50 dark:bg-neutral-800 dark:text-gray-200 dark:placeholder:text-neutral-500'
                      outerInputStyle='my-2 mt-4 lg:mt-2'
                      placeholder='Search by course, subject, or professor'
                      searchSelected={searchSelected}
                      setSearchSelected={setSearchSelected}
                    />
                    {courses.map((course, i) => (
                      <CourseCard
                        className='my-1.5'
                        course={course}
                        key={i}
                        query={query}
                      />
                    ))}
                  </Fragment>
                ) : (
                  <div className='mx-2'>
                    <Skeleton
                      className='mb-2 rounded-lg first:mt-2'
                      count={10}
                      height={256}
                    />
                  </div>
                )}
                {!hasMore ? (
                  courses?.length ? (
                    <div className='mx-auto mt-4 text-center'>
                      <p className='text-gray-500 dark:text-gray-400'>
                        No more courses to show
                      </p>
                    </div>
                  ) : (
                    <div className='mt-4 text-center'>
                      <Spinner />
                    </div>
                  )
                ) : null}
              </div>
            </InfiniteScroll>
          </div>
          <div className='m-2 mx-4 hidden lg:flex'>
            <ExploreFilter variant='desktop' />
          </div>
        </div>
      </div>
      <JumpToTopButton />
    </Layout>
  );
};
