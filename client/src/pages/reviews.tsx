import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

import { CourseReview, ReviewAttachment } from '../components/course-review';
import { JumpToTopButton } from '../components/jump-to-top-button';
import { Layout } from '../components/layout';
import { Spinner } from '../components/spinner';
import { api } from '../lib/api';
import { Review } from '../lib/types';
import { courseIdToUrlParam, spliceCourseCode, timeSince } from '../lib/utils';
import { Loading } from './loading';

export const Reviews = () => {
  const limit = 20;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['reviews'],
      queryFn: ({ pageParam = 0 }) =>
        api.getReviews({
          limit,
          offset: pageParam,
          sorted: true,
          withUserCount: pageParam === 0,
        }),
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.reviews.length < limit) return undefined;
        return allPages.reduce((acc, page) => acc + page.reviews.length, 0);
      },
      initialPageParam: 0,
    });

  const reviews = data?.pages.flatMap((page) => page.reviews);
  const uniqueUserCount = data?.pages[0]?.uniqueUserCount;

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

  if (isLoading || reviews === undefined || uniqueUserCount === undefined) {
    return <Loading />;
  }

  return (
    <Layout>
      <Helmet>
        <title>Reviews - mcgill.courses</title>
        <meta
          name='description'
          content='Check out the latest reviews from students of McGill University.'
        />

        <meta property='og:type' content='website' />
        <meta property='og:url' content={`https://mcgill.courses/reviews`} />
        <meta property='og:title' content={`Reviews - mcgill.courses`} />
        <meta
          property='og:description'
          content='Check out the latest reviews from students of McGill University.'
        />

        <meta
          property='twitter:url'
          content={`https://mcgill.courses/reviews`}
        />
        <meta property='twitter:title' content={`Reviews - mcgill.courses`} />
        <meta
          property='twitter:description'
          content='Check out the latest reviews from students of McGill University.'
        />
      </Helmet>

      <div className='flex flex-col items-center py-8'>
        <div className='mb-16'>
          <h1 className='text-center text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-gray-200'>
            What people are saying
          </h1>
          <p className='mt-2 text-center text-gray-600 dark:text-gray-400'>
            Check out what {uniqueUserCount.toLocaleString('en-us')} verified
            McGill student{uniqueUserCount === 1 ? '' : 's'} on our platform
            {uniqueUserCount === 1 ? ' has' : ' have'} said about courses at
            McGill University.
          </p>
        </div>
        <div className='relative flex w-full max-w-xl flex-col lg:max-w-6xl lg:flex-row lg:justify-center'>
          <div className='ml-auto flex w-full max-w-xl flex-col lg:max-w-4xl'>
            {reviews.map((review: Review) => (
              <div
                className='mb-6'
                key={`${review.courseId}-${review.userId}-${review.timestamp}`}
              >
                <Link
                  to={`/course/${courseIdToUrlParam(review.courseId)}`}
                  className='font-semibold text-gray-800 hover:underline dark:text-gray-200'
                >
                  {spliceCourseCode(review.courseId, ' ')}
                </Link>
                <p className='mb-3 text-xs font-medium text-gray-600 dark:text-gray-400'>
                  {timeSince(parseInt(review.timestamp, 10))}
                </p>
                <div>
                  <CourseReview
                    canModify={false}
                    handleDelete={() => undefined}
                    openEditReview={() => undefined}
                    review={review}
                    attachment={ReviewAttachment.ScrollButton}
                  />
                </div>
              </div>
            ))}
            <div ref={loadMoreRef} className='mt-4 text-center'>
              {isFetchingNextPage && <Spinner />}
              {!hasNextPage && reviews.length > 0 && (
                <p className='text-gray-500 dark:text-gray-400'>
                  No more reviews to show
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <JumpToTopButton />
    </Layout>
  );
};
