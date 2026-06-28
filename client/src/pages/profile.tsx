import { Tab } from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

import { CourseReview, ReviewAttachment } from '../components/course-review';
import { JumpToTopButton } from '../components/jump-to-top-button';
import { Layout } from '../components/layout';
import { DeleteButton } from '../components/ui/delete-button';
import { Spinner } from '../components/ui/spinner';
import { useAuth } from '../hooks/use-auth';
import { api } from '../lib/api';
import type { Review, Subscription } from '../lib/types';
import { courseIdToUrlParam, spliceCourseCode } from '../lib/utils';
import { Loading } from './loading';

const tabs = ['Reviews', 'Likes', 'Subscriptions'] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const getInitialSelectedTabIndex = () => {
  const stored = localStorage.getItem('selectedTabIndex');

  const index = stored ? parseInt(stored, 10) : 0;

  return Number.isInteger(index) && index >= 0 && index < tabs.length
    ? index
    : 0;
};

const EmptyState = ({ text }: { text: string }) => {
  return (
    <div className='flex min-h-44 w-full items-center justify-center px-5 py-10 text-center'>
      <p className='max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400'>
        {text}
      </p>
    </div>
  );
};

const ReviewList = ({
  emptyText,
  reviews,
}: {
  emptyText: string;
  reviews: Review[] | undefined;
}) => {
  if (reviews === undefined) {
    return (
      <div className='mt-2 text-center'>
        <Spinner />
      </div>
    );
  }

  if (!reviews.length) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className='space-y-8'>
      {reviews.map((review) => (
        <div
          className='min-w-0'
          key={`${review.courseId}-${review.userId}-${review.timestamp}`}
        >
          <Link
            to={`/course/${courseIdToUrlParam(review.courseId)}`}
            className='hover:text-mcgill-red inline-flex text-lg font-semibold text-gray-950 transition hover:underline dark:text-gray-100'
          >
            {spliceCourseCode(review.courseId, ' ')}
          </Link>
          <div className='mt-2'>
            <CourseReview
              canModify={false}
              className='rounded-lg bg-white shadow-none dark:bg-neutral-800'
              handleDelete={() => null}
              openEditReview={() => null}
              review={review}
              attachment={ReviewAttachment.ScrollButton}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const SubscriptionList = ({
  subscriptions,
  unsubscribe,
}: {
  subscriptions: Subscription[];
  unsubscribe: (courseId: string) => void;
}) => {
  if (!subscriptions.length) {
    return <EmptyState text='No subscriptions yet.' />;
  }

  return (
    <div>
      {subscriptions.map((subscription) => {
        const courseCode = spliceCourseCode(subscription.courseId, ' ');

        return (
          <div
            key={subscription.courseId}
            className='flex items-center gap-4 py-4'
          >
            <div className='min-w-0'>
              <Link
                className='hover:text-mcgill-red font-semibold text-gray-950 transition hover:underline dark:text-gray-100'
                to={`/course/${courseIdToUrlParam(subscription.courseId)}`}
              >
                {courseCode}
              </Link>
            </div>
            <DeleteButton
              title='Delete Subscription'
              className='ml-auto rounded-md p-2 transition hover:bg-slate-100 dark:hover:bg-neutral-800'
              text={`Are you sure you want to delete your subscription for ${subscription.courseId}? `}
              onConfirm={() => unsubscribe(subscription.courseId)}
              size={20}
            />
          </div>
        );
      })}
    </div>
  );
};

export const Profile = () => {
  const user = useAuth();

  const queryClient = useQueryClient();

  const [selectedTabIndex, setSelectedTabIndex] = useState(
    getInitialSelectedTabIndex
  );

  const { data: userReviews, isError: isReviewsError } = useQuery({
    enabled: Boolean(user),
    queryKey: ['userReviews', user?.id],
    queryFn: () => api.getReviews({ userId: user!.id, sorted: true }),
    select: (data) => data.reviews,
  });

  const { data: likedReviews, isError: isLikedReviewsError } = useQuery({
    enabled: Boolean(user),
    queryKey: ['likedReviews', user?.id],
    queryFn: () => api.getLikedReviews(),
    select: (data) => data.reviews,
  });

  const { data: userSubscriptions, isError: isSubscriptionsError } = useQuery({
    enabled: Boolean(user),
    queryKey: ['subscriptions', user?.id],
    queryFn: () => api.getSubscriptions(),
  });

  const unsubscribeMutation = useMutation({
    mutationFn: (courseId: string) => api.removeSubscription(courseId),
    onSuccess: (_, courseId) => {
      queryClient.setQueryData<Subscription[]>(
        ['subscriptions', user?.id],
        (old) => old?.filter((sub) => sub.courseId !== courseId) ?? []
      );
      toast.success(
        `Subscription for course ${spliceCourseCode(courseId, ' ')} removed successfully`
      );
    },
    onError: () => {
      toast.error(
        'An error occurred while removing your subscription, please try again later'
      );
    },
  });

  useEffect(() => {
    if (isReviewsError) {
      toast.error(
        'An error occurred while fetching your reviews, please try again later'
      );
    }
  }, [isReviewsError]);

  useEffect(() => {
    if (isLikedReviewsError) {
      toast.error(
        'An error occurred while fetching your liked reviews, please try again later'
      );
    }
  }, [isLikedReviewsError]);

  useEffect(() => {
    if (isSubscriptionsError) {
      toast.error(
        'An error occurred while fetching your subscriptions, please try again later'
      );
    }
  }, [isSubscriptionsError]);

  if (!userReviews || !likedReviews || !userSubscriptions) {
    return <Loading />;
  }

  const likedReviewCount = likedReviews.length;

  const tabItems = [
    {
      count: userReviews.length,
      name: tabs[0],
    },
    {
      count: likedReviewCount,
      name: tabs[1],
    },
    {
      count: userSubscriptions.length,
      name: tabs[2],
    },
  ];

  const selectTab = (index: number) => {
    setSelectedTabIndex(index);
    localStorage.setItem('selectedTabIndex', index.toString());
  };

  return (
    <Layout>
      <Helmet>
        <title>Profile - mcgill.courses</title>

        <meta property='og:type' content='website' />
        <meta property='og:url' content='https://mcgill.courses/profile' />
        <meta property='og:title' content='Profile - mcgill.courses' />

        <meta property='twitter:url' content='https://mcgill.courses/profile' />
        <meta property='twitter:title' content='Profile - mcgill.courses' />
      </Helmet>

      <m.div
        initial='hidden'
        animate='visible'
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.08,
            },
          },
        }}
        className='mx-auto max-w-3xl px-2 py-10 sm:px-4 lg:py-14'
      >
        <JumpToTopButton />

        <m.section
          variants={fadeInUp}
          className='mx-auto max-w-3xl text-center'
        >
          <p className='text-mcgill-red text-sm font-semibold tracking-wide uppercase'>
            Profile
          </p>
          {user?.mail && (
            <p className='mt-2 text-sm font-medium text-gray-500 dark:text-gray-400'>
              {user.mail}
            </p>
          )}
        </m.section>

        <m.section variants={fadeInUp} className='mt-10'>
          <Tab.Group selectedIndex={selectedTabIndex} onChange={selectTab}>
            <Tab.List className='flex border-b border-slate-200 dark:border-neutral-700'>
              {tabItems.map(({ count, name }) => (
                <Tab
                  key={name}
                  className={({ selected }) =>
                    twMerge(
                      'flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500',
                      selected
                        ? 'border-mcgill-red text-gray-950 dark:text-gray-100'
                        : 'border-transparent text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-gray-100'
                    )
                  }
                >
                  {name}{' '}
                  <span className='text-xs font-medium text-gray-400 dark:text-gray-500'>
                    {count}
                  </span>
                </Tab>
              ))}
            </Tab.List>
            <div className='mt-6'>
              <AnimatePresence mode='wait'>
                <m.div
                  key={selectedTabIndex}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {selectedTabIndex === 0 && (
                    <ReviewList
                      reviews={userReviews}
                      emptyText='No reviews yet.'
                    />
                  )}
                  {selectedTabIndex === 1 && (
                    <ReviewList
                      reviews={likedReviews}
                      emptyText='No liked reviews yet.'
                    />
                  )}
                  {selectedTabIndex === 2 && (
                    <SubscriptionList
                      subscriptions={userSubscriptions}
                      unsubscribe={(courseId) =>
                        unsubscribeMutation.mutate(courseId)
                      }
                    />
                  )}
                </m.div>
              </AnimatePresence>
            </div>
          </Tab.Group>
        </m.section>
      </m.div>
    </Layout>
  );
};
