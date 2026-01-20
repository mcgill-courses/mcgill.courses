import { useInfiniteQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Skeleton from 'react-loading-skeleton';

import { CourseCard } from '../components/course-card';
import { ExploreFilter, SortBy } from '../components/explore-filter';
import { FilterToggle } from '../components/filter-toggle';
import { JumpToTopButton } from '../components/jump-to-top-button';
import { Layout } from '../components/layout';
import { SearchBar } from '../components/search-bar';
import { Spinner } from '../components/spinner';
import { useDarkMode } from '../hooks/use-dark-mode';
import { useExploreFilterState } from '../hooks/use-explore-filter-state';
import { api } from '../lib/api';
import { getCurrentTerms } from '../lib/utils';

const makeSortPayload = (sort: SortBy) => {
  switch (sort) {
    case '':
      return undefined;
    case 'Highest Rating':
      return {
        sortType: 'rating',
        reverse: true,
      };
    case 'Lowest Rating':
      return {
        sortType: 'rating',
        reverse: false,
      };
    case 'Hardest':
      return {
        sortType: 'difficulty',
        reverse: true,
      };
    case 'Easiest':
      return {
        sortType: 'difficulty',
        reverse: false,
      };
    case 'Most Reviews':
      return {
        sortType: 'reviewCount',
        reverse: true,
      };
    case 'Least Reviews':
      return {
        sortType: 'reviewCount',
        reverse: false,
      };
  }
};

export const Explore = () => {
  const limit = 20;
  const currentTerms = getCurrentTerms();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState<string>('');
  const [searchSelected, setSearchSelected] = useState<boolean>(false);

  const [darkMode] = useDarkMode();

  const { selectedSubjects, selectedLevels, selectedTerms, sortBy } =
    useExploreFilterState();

  const nullable = (arr: string[]) => (arr.length === 0 ? null : arr);

  const filters = {
    subjects: nullable(selectedSubjects),
    levels: nullable(selectedLevels.map((l) => l.charAt(0))),
    terms: nullable(
      selectedTerms.map(
        (term) => currentTerms.filter((t) => t.split(' ')[0] === term)[0]
      )
    ),
    query: query === '' ? null : query,
    sortBy: makeSortPayload(sortBy),
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [
        'courses',
        selectedSubjects,
        selectedLevels,
        selectedTerms,
        sortBy,
        query,
      ],
      queryFn: ({ pageParam = 0 }) =>
        api.getCourses(limit, pageParam, pageParam === 0, filters),
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.courses.length < limit) return undefined;
        return allPages.reduce((acc, page) => acc + page.courses.length, 0);
      },
      initialPageParam: 0,
    });

  const courses = data?.pages.flatMap((page) => page.courses);
  const courseCount = data?.pages[0]?.courseCount;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
            <div className='ml-auto flex w-full max-w-xl flex-col'>
              {courses ? (
                <Fragment>
                  <SearchBar
                    handleInputChange={(value) => setQuery(value)}
                    iconStyle='mt-2 lg:mt-0'
                    inputStyle='block rounded-lg w-full bg-slate-200 p-3 pr-5 pl-10 text-sm text-black outline-none dark:border-neutral-50 dark:bg-neutral-800 dark:text-gray-200 dark:placeholder:text-neutral-500'
                    outerInputStyle='my-2 mt-4 lg:mt-2'
                    placeholder='Search by course code, title, description or instructor name'
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
                    baseColor={darkMode ? 'rgb(38 38 38)' : 'rgb(248 250 252)'}
                    className='mb-2 rounded-lg first:mt-2'
                    count={10}
                    duration={2}
                    height={256}
                    highlightColor={
                      darkMode ? 'rgb(64 64 64)' : 'rgb(226 232 240)'
                    }
                  />
                </div>
              )}
              <div ref={loadMoreRef} className='mt-4 text-center'>
                {isFetchingNextPage && <Spinner />}
                {!hasNextPage && courses && courses.length > 0 && (
                  <p className='text-gray-500 dark:text-gray-400'>
                    No more courses to show
                  </p>
                )}
              </div>
            </div>
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
