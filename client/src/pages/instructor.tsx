import { ExternalLink, Leaf, Snowflake, Sun } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'current' | 'all'>('current');

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

  const currentTerm = getCurrentTerm();

  const hasCurrentCourses = instructor
    ? courses.some((course) =>
        course.instructors.some(
          (ins) => ins.name === instructor.name && ins.term === currentTerm
        )
      )
    : false;

  useEffect(() => {
    if (instructor && !hasCurrentCourses) {
      setActiveTab('all');
    }
  }, [instructor, hasCurrentCourses]);

  if (instructor === undefined) return <Loading />;
  if (instructor === null) return <NotFound />;

  const userReview = reviews.find((r) => r.userId === user?.id);

  const reviewCount = reviews.length;
  const reviewLabel = reviewCount === 1 ? 'review' : 'reviews';

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

      <div className='mx-auto mt-10 max-w-5xl md:mt-10'>
        <div className='rounded-md bg-slate-50 p-6 dark:bg-neutral-800'>
          <div className='mb-6 flex flex-row items-center space-x-2'>
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

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <div>
              {(() => {
                const season = currentTerm.split(' ')[0].toLowerCase();

                const SeasonIcon =
                  season === 'fall'
                    ? Leaf
                    : season === 'winter'
                      ? Snowflake
                      : Sun;

                const iconColor =
                  season === 'fall'
                    ? 'text-red-600'
                    : season === 'winter'
                      ? 'text-sky-500'
                      : 'text-yellow-500';

                return (
                  <Fragment>
                    <div className='mb-4 flex border-b border-gray-200 dark:border-neutral-700'>
                      {currentCourses.length > 0 && (
                        <button
                          onClick={() => setActiveTab('current')}
                          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'current'
                              ? 'border-b-2 border-gray-800 text-gray-800 dark:border-gray-200 dark:text-gray-200'
                              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                          }`}
                        >
                          <SeasonIcon className={iconColor} size={14} />
                          {currentTerm} ({currentCourses.length})
                        </button>
                      )}
                      <button
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeTab === 'all'
                            ? 'border-b-2 border-gray-800 text-gray-800 dark:border-gray-200 dark:text-gray-200'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                      >
                        All Courses ({uniqueCourses.length})
                      </button>
                    </div>

                    {activeTab === 'current' && currentCourses.length > 0 ? (
                      <div className='grid grid-cols-2 gap-2'>
                        {currentCourses.map((course) => (
                          <Link
                            key={course._id}
                            to={`/course/${courseIdToUrlParam(course._id)}`}
                            className='group flex flex-col rounded px-3 py-2 transition'
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
                    ) : uniqueCourses.length > 0 ? (
                      <div className='grid grid-cols-2 gap-2'>
                        {uniqueCourses.map((course) => (
                          <Link
                            key={course._id}
                            to={`/course/${courseIdToUrlParam(course._id)}`}
                            className='group flex flex-col rounded px-3 py-2 transition'
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
                    ) : (
                      <p className='text-sm text-gray-500 dark:text-gray-400'>
                        This professor hasn't taught any courses yet.
                      </p>
                    )}
                  </Fragment>
                );
              })()}
            </div>

            <div className='flex justify-center'>
              {reviewCount !== 0 ? (
                <div>
                  <CourseInfoStats variant='large' reviews={reviews} />
                  <p className='mt-4 text-sm text-gray-500 dark:text-gray-400'>
                    {reviewCount} {reviewLabel}
                  </p>
                </div>
              ) : null}
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
