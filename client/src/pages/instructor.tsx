import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, Leaf, Snowflake, Sun } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { CourseInfoStats } from '../components/course-info-stats';
import { CourseReview, ReviewAttachment } from '../components/course-review';
import { Layout } from '../components/layout';
import { ReviewEmptyPrompt } from '../components/review-empty-prompt';
import { useAuth } from '../hooks/use-auth';
import { api } from '../lib/api';
import { Course, type Instructor as InstructorType } from '../lib/types';
import type { Review } from '../lib/types';
import { courseIdToUrlParam, getCurrentTerm } from '../lib/utils';
import { Loading } from './loading';
import { NotFound } from './not-found';

export const Instructor = () => {
  const params = useParams<{ name: string }>();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const [instructor, setInstructor] = useState<
    InstructorType | undefined | null
  >(undefined);

  const [courses, setCourses] = useState<Course[]>([]);
  const [showAllCourses, setShowAllCourses] = useState(false);

  const user = useAuth();

  useEffect(() => {
    if (!params.name) return;

    api
      .getInstructor(params.name)
      .then((data) => {
        setInstructor(data.instructor);
        setReviews(data.reviews);
        setCourses(data.courses);
      })
      .catch(() => {
        toast.error('Failed to fetch instructor.');
      });
  }, [params.name]);

  if (instructor === undefined) return <Loading />;
  if (instructor === null) return <NotFound />;

  const userReview = reviews.find((r) => r.userId === user?.id);

  const reviewCount = reviews.length;
  const reviewLabel = reviewCount === 1 ? 'review' : 'reviews';

  const currentTerm = getCurrentTerm();
  const decodedName = params.name ? decodeURIComponent(params.name) : '';

  const uniqueCourses = courses.filter((course) =>
    course.instructors.some((instructor) => instructor.name === decodedName)
  );

  const currentCourses = uniqueCourses.filter((course) =>
    course.instructors.some(
      (ins) => ins.name === instructor.name && ins.term === currentTerm
    )
  );

  const updateLikes = (review: Review) => {
    return (likes: number) => {
      if (reviews) {
        const updated = reviews.slice();
        const r = updated.find(
          (r) => r.courseId == review.courseId && r.userId == review.userId
        );

        if (r === undefined) {
          toast.error("Can't update likes for review that doesn't exist.");
          return;
        }

        r.likes = likes;
        setReviews(updated);
      }
    };
  };

  return (
    <Layout>
      <Helmet>
        <title>{instructor.name} - mcgill.courses</title>

        <meta property='og:type' content='website' />
        <meta property='og:url' content={`https://mcgill.courses/explore`} />
        <meta
          property='og:title'
          content={`${instructor.name}- mcgill.courses`}
        />

        <meta
          property='twitter:url'
          content={`https://mcgill.courses/explore`}
        />
        <meta
          property='twitter:title'
          content={`${instructor.name}- mcgill.courses`}
        />
      </Helmet>

      <div className='mx-auto mt-10 flex max-w-5xl overflow-hidden md:mt-0'>
        <div className='flex w-screen flex-row rounded-md bg-slate-50 p-2 dark:bg-neutral-800 md:mt-10'>
          <div className='flex flex-1 flex-col md:flex-row'>
            <div className='flex w-fit flex-col p-4 md:w-1/2'>
              <div className='flex flex-row items-center space-x-2 align-middle'>
                <h1 className='break-words text-4xl font-semibold text-gray-800 dark:text-gray-200'>
                  {params.name && decodeURIComponent(params.name)}
                </h1>
                <a
                  href={`https://www.mcgill.ca/search/?query=${params.name && encodeURIComponent(params.name)}`}
                  className='my-auto dark:text-gray-200'
                  target='_blank'
                >
                  <ExternalLink
                    size={20}
                    className='ml-1 transition-colors duration-300 hover:stroke-red-600'
                  />
                </a>
              </div>
              <div className='mt-4 text-gray-500 dark:text-gray-400'>
                {currentCourses.length > 0 && (
                  <div className='mb-5'>
                    {(() => {
                      const season = currentTerm.split(' ')[0].toLowerCase();

                      const bgColor =
                        season === 'fall'
                          ? 'bg-red-50 dark:bg-red-950/30'
                          : season === 'winter'
                            ? 'bg-sky-50 dark:bg-sky-950/30'
                            : 'bg-yellow-50 dark:bg-yellow-950/30';

                      const iconColor =
                        season === 'fall'
                          ? 'text-red-600'
                          : season === 'winter'
                            ? 'text-sky-500'
                            : 'text-yellow-500';

                      const SeasonIcon =
                        season === 'fall'
                          ? Leaf
                          : season === 'winter'
                            ? Snowflake
                            : Sun;

                      return (
                        <div className={`rounded-md ${bgColor} p-2.5`}>
                          <div className='mb-1.5 flex items-center gap-1.5'>
                            <SeasonIcon className={iconColor} size={16} />
                            <span className='text-sm font-semibold text-gray-700 dark:text-gray-200'>
                              {currentTerm}
                            </span>
                          </div>
                          <div className='flex flex-col gap-1.5'>
                            {currentCourses.map((course) => (
                              <Link
                                key={course._id}
                                to={`/course/${courseIdToUrlParam(course._id)}`}
                                className='group flex flex-col rounded px-2.5 py-1.5 transition hover:bg-white/50 dark:hover:bg-neutral-700/50'
                              >
                                <span className='text-sm font-semibold text-gray-800 transition group-hover:text-red-600 dark:text-gray-100'>
                                  {course._id}
                                </span>
                                <span className='text-xs text-gray-600 dark:text-gray-400'>
                                  {course.title}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {uniqueCourses.length ? (
                  <div className='rounded-md bg-gray-100 p-2.5 dark:bg-neutral-700/50'>
                    <button
                      onClick={() => setShowAllCourses(!showAllCourses)}
                      className='flex w-full items-center justify-between'
                    >
                      <span className='text-sm font-semibold text-gray-700 dark:text-gray-200'>
                        All Courses ({uniqueCourses.length})
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-gray-500 transition-transform dark:text-gray-400 ${showAllCourses ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <AnimatePresence>
                      {showAllCourses && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className='overflow-hidden'
                        >
                          <div className='mt-1.5 flex flex-col gap-1.5'>
                            {uniqueCourses.map((course) => (
                              <Link
                                key={course._id}
                                to={`/course/${courseIdToUrlParam(course._id)}`}
                                className='group flex flex-col rounded px-2.5 py-1.5 transition hover:bg-white/50 dark:hover:bg-neutral-700/50'
                              >
                                <span className='text-sm font-semibold text-gray-800 transition group-hover:text-red-600 dark:text-gray-100'>
                                  {course._id}
                                </span>
                                <span className='text-xs text-gray-600 dark:text-gray-400'>
                                  {course.title}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <p>This professor hasn't taught any courses yet</p>
                )}
              </div>
              {reviewCount !== 0 && (
                <Fragment>
                  <div className='grow py-3' />
                  <CourseInfoStats className='md:hidden' reviews={reviews} />
                  <p className='mt-4 text-sm text-gray-500 dark:text-gray-400'>
                    {reviewCount} {reviewLabel}
                  </p>
                </Fragment>
              )}
            </div>
            <div className='ml-10 hidden w-5/12 justify-center rounded-md bg-neutral-50 py-6 dark:bg-neutral-800 md:flex lg:mt-6'>
              <CourseInfoStats variant='large' reviews={reviews} />
            </div>
          </div>
        </div>
      </div>
      <div className='mx-auto mt-4 max-w-5xl'>
        <div>
          {userReview && (
            <CourseReview
              canModify={false}
              handleDelete={() => undefined}
              includeTaughtBy={false}
              openEditReview={() => undefined}
              review={userReview}
              attachment={ReviewAttachment.ScrollButton}
              updateLikes={updateLikes(userReview)}
            />
          )}
          {reviews &&
            reviews
              .filter((review) => (user ? review.userId !== user.id : true))
              .slice(0, showAllReviews ? reviews.length : 8)
              .map((review, i) => (
                <CourseReview
                  canModify={false}
                  handleDelete={() => undefined}
                  includeTaughtBy={false}
                  key={i}
                  openEditReview={() => undefined}
                  review={review}
                  attachment={ReviewAttachment.ScrollButton}
                  updateLikes={updateLikes(review)}
                />
              ))}
        </div>
        {!showAllReviews && reviewCount > 8 && (
          <div className='flex justify-center text-gray-400 dark:text-neutral-500'>
            <button
              className='size-full border border-dashed border-neutral-400 py-2 dark:border-neutral-500'
              onClick={() => setShowAllReviews(true)}
            >
              Show all {reviewCount} {reviewLabel}
            </button>
          </div>
        )}
        {reviewCount === 0 && (
          <ReviewEmptyPrompt className='my-8'>
            No reviews have been left for this instructor yet, be the first!
          </ReviewEmptyPrompt>
        )}
      </div>
    </Layout>
  );
};
