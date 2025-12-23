import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { useAuth } from '../hooks/use-auth';
import { api } from '../lib/api';
import type { Review, Subscription } from '../lib/types';
import type { Course } from '../lib/types';
import { CourseDescription } from './course-description';
import { CourseInfoStats } from './course-info-stats';
import { CourseTerms } from './course-terms';

type CourseInfoProps = {
  course: Course;
  reviews: Review[];
};

export const CourseInfo = ({ course, reviews }: CourseInfoProps) => {
  const user = useAuth();

  const queryClient = useQueryClient();

  const subscriptionQueryKey = [
    'subscription',
    course._id,
    user?.id ?? 'guest',
  ] as const;

  const { data: subscription, isError: isSubscriptionError } = useQuery({
    enabled: Boolean(user),
    queryFn: () => api.getSubscription(course._id),
    queryKey: subscriptionQueryKey,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!isSubscriptionError) return;

    toast.error(
      `Failed to check subscription for course ${course.subject} ${course.code}`
    );
  }, [course.code, course.subject, isSubscriptionError]);

  const subscribeMutation = useMutation({
    mutationFn: () => api.addSubscription(course._id),
    onSuccess: () => {
      if (!user) return;

      queryClient.setQueryData<Subscription | null>(subscriptionQueryKey, {
        courseId: course._id,
        userId: user.id,
      });

      toast.success(`Subscribed to course ${course.subject} ${course.code}.`);
    },
    onError: () => {
      toast.error(
        `Failed to subscribe to course ${course.subject} ${course.code}.`
      );
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: () => api.removeSubscription(course._id),
    onSuccess: () => {
      queryClient.setQueryData<Subscription | null>(subscriptionQueryKey, null);

      toast.success(
        `Unsubscribed from course ${course.subject} ${course.code}`
      );
    },
    onError: () => {
      toast.error(
        `Failed to unsubscribe from course ${course.subject} ${course.code}`
      );
    },
  });

  const isSubscribed = Boolean(subscription);

  const reviewCount = reviews.length;
  const reviewLabel = reviewCount === 1 ? 'review' : 'reviews';

  return (
    <div className='relative flex w-full flex-row rounded-md bg-slate-50 px-6 pt-8 shadow-sm dark:bg-neutral-800 md:mt-10'>
      <div className='flex w-full flex-col md:w-7/12'>
        <div className='flex flex-row space-x-2 align-middle'>
          <div className='flex items-center space-x-2'>
            <h1 className='text-3xl font-semibold text-gray-800 dark:text-gray-200'>
              {course.subject} {course.code}
            </h1>
            <div className='flex h-6 items-center rounded-full bg-slate-200 px-2 text-xs font-medium dark:bg-neutral-700 dark:text-gray-300 '>
              {course.credits} {course.credits === '1' ? 'Credit' : 'Credits'}
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {user &&
              (isSubscribed ? (
                <BellOff
                  size={20}
                  onClick={() => unsubscribeMutation.mutate()}
                  data-testid='unsubscribe-icon'
                  className='my-auto ml-1 cursor-pointer transition-colors duration-300 hover:stroke-red-600 dark:text-gray-200'
                />
              ) : (
                <Bell
                  size={20}
                  onClick={() => subscribeMutation.mutate()}
                  data-testid='subscribe-icon'
                  className='my-auto ml-1 cursor-pointer transition-colors duration-300 hover:stroke-red-600 dark:text-gray-200'
                />
              ))}
            {course.url ? (
              <a
                href={course.url}
                className='my-auto dark:text-gray-200'
                target='_blank'
              >
                <ExternalLink
                  size={20}
                  className='ml-1 transition-colors duration-300 hover:stroke-red-600'
                />
              </a>
            ) : null}
          </div>
        </div>
        <div className='py-1' />
        <h2 className='text-2xl text-gray-800 dark:text-gray-200'>
          {course.title}
        </h2>
        <CourseTerms course={course} variant='large' />
        <div className='py-1' />
        <p className='break-words text-gray-500 dark:text-gray-400'>
          <CourseDescription description={course.description} />
        </p>
        <div className='grow py-3' />
        <CourseInfoStats className='mb-4 sm:hidden' reviews={reviews} />
        <CourseInfoStats
          className='hidden gap-x-6 sm:mb-6 sm:flex md:mb-0 md:hidden'
          variant='medium'
          reviews={reviews}
        />
        <p className='mb-6 text-sm text-gray-500 dark:text-gray-400'>
          {reviewCount} {reviewLabel}
        </p>
      </div>
      <div className='hidden w-5/12 justify-center rounded-md bg-neutral-50 py-4 dark:bg-neutral-800 md:mx-5 md:flex lg:ml-12 lg:mt-6 xl:justify-start'>
        <CourseInfoStats
          variant='large'
          reviews={reviews}
          className='lg:mr-8'
        />
      </div>
    </div>
  );
};
