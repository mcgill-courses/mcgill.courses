import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

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

  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [reviews, setReviews] = useState<Review[] | undefined>(undefined);
  const [uniqueUserCount, setUniqueUserCount] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    api
      .getReviews({ limit, offset: 0, sorted: true, withUserCount: true })
      .then((data) => {
        setReviews(data.reviews);
        setUniqueUserCount(data.uniqueUserCount);
      })
      .catch(() => {
        toast.error('Failed to fetch reviews, please try again later');
      });
    setHasMore(true);
    setOffset(limit);
  }, []);

  const fetchMore = async () => {
    const batch = await api.getReviews({ limit, offset, sorted: true });

    if (batch.reviews.length === 0) setHasMore(false);
    else {
      setReviews(reviews?.concat(batch.reviews));
      setOffset((prev) => prev + limit);
    }
  };

  if (reviews === undefined || uniqueUserCount === undefined) {
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
          <InfiniteScroll
            dataLength={reviews?.length || 0}
            hasMore={hasMore}
            loader={
              (reviews?.length || 0) >= 20 &&
              hasMore && (
                <div className='mt-4 text-center'>
                  <Spinner />
                </div>
              )
            }
            next={fetchMore}
            style={{ overflowY: 'hidden' }}
          >
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
              {!hasMore ? (
                reviews?.length ? (
                  <div className='mx-[200px] mt-4 text-center'>
                    <p className='text-gray-500 dark:text-gray-400'>
                      No more reviews to show
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
      </div>
      <JumpToTopButton />
    </Layout>
  );
};
