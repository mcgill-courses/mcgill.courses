import { Menu, Transition } from '@headlessui/react';
import { Bell, Circle, Trash2 } from 'lucide-react';
import React, { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { api } from '../lib/api';
import type { Notification } from '../lib/types';
import { courseIdToUrlParam, spliceCourseCode } from '../lib/utils';
import { CourseReview, ReviewAttachment } from './course-review';

export const NotificationDropdown = ({
  notifications,
  setNotifications,
}: {
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
}) => {
  const [refs, setRefs] = useState<React.RefObject<HTMLDivElement | null>[]>(
    []
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRefs(notifications.map(() => React.createRef<HTMLDivElement>()));
  }, [notifications]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    notifications.forEach((notification, index) => {
      const ref = refs[index];

      if (ref && ref.current) {
        const handleIntersection = (entries: IntersectionObserverEntry[]) => {
          entries.forEach((entry: IntersectionObserverEntry) => {
            if (entry.isIntersecting) updateNotification(notification);
          });
        };

        const observer = new IntersectionObserver(handleIntersection);
        observer.observe(ref.current as Element);

        observers.push(observer);
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [notifications, refs, isMenuOpen]);

  useEffect(() => {
    if (seen.size === 0) return;

    setNotifications(
      notifications.map((n) => {
        return seen.has(n.review.courseId) ? { ...n, seen: true } : n;
      })
    );

    setSeen(new Set());
  }, [isMenuOpen]);

  const updateNotification = async (notification: Notification) => {
    if (notification.seen) return;

    try {
      await api.updateNotification(
        notification.review.courseId,
        notification.review.userId,
        true
      );
      seen.add(notification.review.courseId);
    } catch {
      toast.error('Failed to update notification');
    }
  };

  const deleteNotification = async (courseId: string, userId: string) => {
    try {
      await api.deleteNotification(courseId, userId);
      setNotifications(
        notifications.filter(
          (notification) =>
            notification.review.courseId !== courseId ||
            notification.review.userId !== userId
        )
      );
      toast.success('Successfully deleted notification');
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  return (
    <div className='z-30 text-right'>
      <Menu as='div' className='relative inline-block text-left'>
        {({ open }) => {
          useEffect(() => {
            setIsMenuOpen(open);
          }, [open]);

          return (
            <>
              <div>
                <Menu.Button className='m-2 inline-flex cursor-pointer justify-center text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white'>
                  <div className='relative'>
                    <Bell
                      className='-mr-1 ml-2 size-5 text-neutral-500 dark:text-gray-400'
                      aria-hidden='true'
                    />
                    {notifications.filter((notification) => !notification.seen)
                      .length !== 0 && (
                      <div className='absolute top-px right-[-3px] size-2 rounded-full bg-red-600' />
                    )}
                  </div>
                </Menu.Button>
              </div>
              <Transition
                as={Fragment}
                enter='transition ease-out duration-100'
                enterFrom='transform opacity-0 scale-95'
                enterTo='transform opacity-100 scale-100'
                leave='transition ease-in duration-75'
                leaveFrom='transform opacity-100 scale-100'
                leaveTo='transform opacity-0 scale-95'
              >
                <Menu.Items className='styled-scrollbar absolute -right-8 z-30 mt-2 max-h-[800px] max-w-[325px] origin-top-right divide-y divide-gray-100 overflow-auto rounded-md bg-slate-100 shadow-lg md:max-w-[800px] dark:bg-neutral-900'>
                  <div className='p-2'>
                    {notifications.length !== 0 ? (
                      notifications.map((notification, i) => (
                        <Menu.Item
                          key={`${notification.review.userId}-${notification.review.timestamp}`}
                        >
                          {() => (
                            <div
                              className='m-2'
                              ref={refs[i]}
                              onClick={(e) => e.preventDefault()}
                              role='none'
                            >
                              <div className='mb-2 flex items-center'>
                                <div className='flex items-center gap-x-1'>
                                  <p className='font-semibold text-gray-800 dark:text-gray-200'>
                                    <Link
                                      to={`/course/${courseIdToUrlParam(
                                        notification.review.courseId
                                      )}`}
                                    >
                                      {spliceCourseCode(
                                        notification.review.courseId,
                                        ' '
                                      )}
                                    </Link>
                                  </p>
                                  {!notification.seen && (
                                    <Circle className='size-2 fill-red-400 text-red-400' />
                                  )}
                                </div>
                                <Trash2
                                  onClick={async () =>
                                    await deleteNotification(
                                      notification.review.courseId,
                                      notification.review.userId
                                    )
                                  }
                                  className='ml-auto text-right text-gray-700 underline hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50'
                                  size={16}
                                />
                              </div>
                              <CourseReview
                                className='rounded-md'
                                review={notification.review}
                                canModify={false}
                                handleDelete={() => undefined}
                                openEditReview={() => undefined}
                                attachment={ReviewAttachment.ScrollButton}
                              />
                            </div>
                          )}
                        </Menu.Item>
                      ))
                    ) : (
                      <p className='w-[325px] p-1 text-sm leading-6 font-medium text-gray-600 dark:text-gray-300'>
                        All caught up! Subscribe to courses to get notified when
                        a user leaves a review.
                      </p>
                    )}
                  </div>
                </Menu.Items>
              </Transition>
            </>
          );
        }}
      </Menu>
    </div>
  );
};
