import { Tab } from '@headlessui/react';
import { Bell, FileText, ThumbsUp, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

import { CourseReview, ReviewAttachment } from '../components/course-review';
import { DeleteButton } from '../components/delete-button';
import { JumpToTopButton } from '../components/jump-to-top-button';
import { Layout } from '../components/layout';
import { Spinner } from '../components/spinner';
import { useAuth } from '../hooks/use-auth';
import { api } from '../lib/api';
import type { Subscription } from '../lib/types';
import type { Review } from '../lib/types';
import { courseIdToUrlParam } from '../lib/utils';
import { spliceCourseCode } from '../lib/utils';
import { Loading } from './loading';

export const Profile = () => {
  const user = useAuth();

  const [userReviews, setUserReviews] = useState<Review[] | undefined>(
    undefined
  );
  const [likedReviews, setLikedReviews] = useState<Review[] | undefined>(
    undefined
  );
  const [userSubscriptions, setUserSubscriptions] = useState<
    Subscription[] | undefined
  >(undefined);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  useEffect(() => {
    if (!user) return;

    const selectedTabIndex = localStorage.getItem('selectedTabIndex');

    if (selectedTabIndex) setSelectedTabIndex(parseInt(selectedTabIndex, 10));

    api
      .getReviews({ userId: user.id, sorted: true })
      .then((data) => setUserReviews(data.reviews))
      .catch(() =>
        toast.error(
          'An error occurred while fetching your reviews, please try again later.'
        )
      );

    api
      .getLikedReviews()
      .then((data) => setLikedReviews(data.reviews))
      .catch(() => {
        setLikedReviews([]);
        toast.error(
          'An error occurred while fetching your liked reviews, please try again later.'
        );
      });

    api
      .getSubscriptions()
      .then((data) => setUserSubscriptions(data))
      .catch(() =>
        toast.error(
          'An error occurred while fetching your subscriptions, please try again later.'
        )
      );
  }, []);

  const removeSubscription = async (courseId: string) => {
    try {
      await api.removeSubscription(courseId);

      setUserSubscriptions(
        userSubscriptions?.filter(
          (subscription) => subscription.courseId !== courseId
        )
      );

      toast.success(
        `Subscription for course ${spliceCourseCode(
          courseId,
          ' '
        )} removed successfully.`
      );
    } catch (err) {
      toast.error(
        'An error occurred while removing your subscription, please try again later.'
      );
    }
  };

  if (!userReviews || !userSubscriptions) return <Loading />;

  const tabs = ['Reviews', 'Likes', 'Subscriptions'];

  const likedReviewCount = likedReviews?.length;

  const likedReviewLabel =
    likedReviewCount === 1 ? 'liked review' : 'liked reviews';

  return (
    <Layout>
      <Helmet>
        <title>Profile - mcgill.courses</title>

        <meta property='og:type' content='website' />
        <meta property='og:url' content={`https://mcgill.courses/about`} />
        <meta property='og:title' content={`Profile - mcgill.courses`} />

        <meta property='twitter:url' content={`https://mcgill.courses/about`} />
        <meta property='twitter:title' content={`Profile - mcgill.courses`} />
      </Helmet>

      <div className='mx-auto max-w-2xl'>
        <JumpToTopButton />
        <div className='flex w-full justify-center'>
          <div className='mx-4 flex w-full flex-row rounded-md bg-slate-50 p-6 dark:bg-neutral-800 md:mt-10'>
            <div className='flex w-fit flex-col space-y-3 md:m-4'>
              <User size={64} className={'-ml-3 text-gray-500'} />
              <h1 className='text-lg font-medium text-gray-700 dark:text-gray-300 md:text-xl'>
                Your Profile
              </h1>
              <div className='flex items-center gap-x-1'>
                <FileText
                  className='text-neutral-500 dark:text-gray-400'
                  aria-hidden='true'
                  size={20}
                />
                <p className='text-gray-700 dark:text-gray-300'>
                  {userReviews?.length}{' '}
                  {'review' + (userReviews?.length === 1 ? '' : 's')}
                </p>
              </div>
              <div className='flex items-center gap-x-1'>
                <Bell
                  className='text-neutral-500 dark:text-gray-400'
                  aria-hidden='true'
                  size={20}
                />
                <p className='text-gray-700 dark:text-gray-300'>
                  {userSubscriptions?.length}{' '}
                  {'subscription' +
                    (userSubscriptions?.length === 1 ? '' : 's')}
                </p>
              </div>
              <div className='flex items-center gap-x-1'>
                <ThumbsUp
                  className='text-neutral-500 dark:text-gray-400'
                  aria-hidden='true'
                  size={20}
                />
                <p className='text-gray-700 dark:text-gray-300'>
                  {likedReviewCount === undefined ? '-' : likedReviewCount}{' '}
                  {likedReviewLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
        <Tab.Group selectedIndex={selectedTabIndex}>
          <Tab.List className='m-4 flex space-x-1 rounded-xl bg-slate-200 p-1 dark:bg-neutral-700/20'>
            {tabs.map((tab, index) => (
              <Tab
                key={tab}
                onClick={() => {
                  setSelectedTabIndex(index);
                  localStorage.setItem('selectedTabIndex', index.toString());
                }}
                className={({ selected }) =>
                  twMerge(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-gray-800',
                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-gray-400 focus:outline-none',
                    selected
                      ? 'bg-white shadow'
                      : 'text-gray-700 hover:bg-white/[0.12] hover:text-gray-400 dark:text-gray-200'
                  )
                }
              >
                {tab}
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels>
            <Tab.Panel>
              <div className='m-4 flex flex-col gap-4'>
                {userReviews === undefined ? (
                  <div className='mt-2 text-center'>
                    <Spinner />
                  </div>
                ) : userReviews.length ? (
                  userReviews.map((review, i) => {
                    return (
                      <div key={i}>
                        <div className='flex'>
                          <Link
                            to={`/course/${courseIdToUrlParam(
                              review.courseId
                            )}`}
                            className='text-xl font-semibold text-gray-800 hover:underline dark:text-gray-200'
                          >
                            {spliceCourseCode(review.courseId, ' ')}
                          </Link>
                        </div>
                        <div className='my-2 rounded-lg border-gray-800 duration-300 ease-in-out'>
                          <CourseReview
                            canModify={false}
                            handleDelete={() => null}
                            openEditReview={() => null}
                            review={review}
                            attachment={ReviewAttachment.ScrollButton}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className='flex w-full items-center justify-center gap-x-2'>
                    <FileText
                      className='stroke-[1.25] text-gray-400 dark:text-gray-600'
                      size={20}
                    />
                    <div className='text-center text-sm text-gray-600 dark:text-gray-500'>
                      No reviews found, if you've taken a course in the past,
                      don't be shy to leave a review!
                    </div>
                  </div>
                )}
              </div>
            </Tab.Panel>
            <Tab.Panel>
              <div className='m-4 flex flex-col gap-4'>
                {likedReviews === undefined ? (
                  <div className='mt-2 text-center'>
                    <Spinner />
                  </div>
                ) : likedReviews.length ? (
                  likedReviews.map((review, i) => {
                    return (
                      <div key={i}>
                        <div className='flex'>
                          <Link
                            to={`/course/${courseIdToUrlParam(
                              review.courseId
                            )}`}
                            className='text-xl font-semibold text-gray-800 hover:underline dark:text-gray-200'
                          >
                            {spliceCourseCode(review.courseId, ' ')}
                          </Link>
                        </div>
                        <div className='my-2 rounded-lg border-gray-800 duration-300 ease-in-out'>
                          <CourseReview
                            canModify={false}
                            handleDelete={() => null}
                            openEditReview={() => null}
                            review={review}
                            attachment={ReviewAttachment.ScrollButton}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className='flex w-full items-center justify-center gap-x-2'>
                    <ThumbsUp
                      className='stroke-[1.25] text-gray-400 dark:text-gray-600'
                      size={20}
                    />
                    <div className='text-center text-sm text-gray-600 dark:text-gray-500'>
                      No liked reviews yet, tap the thumbs-up on a review to
                      save it here!
                    </div>
                  </div>
                )}
              </div>
            </Tab.Panel>
            <Tab.Panel>
              <div>
                {userSubscriptions?.length !== 0 ? (
                  userSubscriptions?.map((subscription, i) => (
                    <div
                      key={i}
                      className='m-4 flex items-center rounded-lg border-gray-800 bg-white p-4 duration-300 ease-in-out dark:bg-neutral-800'
                    >
                      <Link
                        className='font-semibold text-gray-800 dark:text-gray-200'
                        to={`/course/${courseIdToUrlParam(
                          subscription.courseId
                        )}`}
                      >
                        {subscription.courseId}
                      </Link>
                      <DeleteButton
                        title='Delete Subscription'
                        className='ml-auto'
                        text={`Are you sure you want to delete your subscription for ${subscription.courseId}? `}
                        onConfirm={() =>
                          removeSubscription(subscription.courseId)
                        }
                        size={20}
                      />
                    </div>
                  ))
                ) : (
                  <div className='flex w-full items-center justify-center gap-x-2'>
                    <Bell
                      className='text-gray-400 dark:text-gray-600'
                      aria-hidden='true'
                      size={20}
                    />
                    <div className='text-center text-sm text-gray-600 dark:text-gray-500'>
                      No subscriptions found, click the bell icon on a course to
                      add one!
                    </div>
                  </div>
                )}
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </Layout>
  );
};
