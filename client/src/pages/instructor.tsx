import { ExternalLink, Leaf, Snowflake, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import {
  courseIdToUrlParam,
  getCurrentTerm,
  getCurrentTerms,
} from '../lib/utils';
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

  const currentTerm = getCurrentTerm();
  const [activeTab, setActiveTab] = useState<string>(currentTerm);

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

  const academicTerms = getCurrentTerms();

  // Reorder terms so current term is first
  const orderedTerms = [
    currentTerm,
    ...academicTerms.filter((t) => t !== currentTerm),
  ];

  const getCoursesForTerm = (term: string) => {
    if (!instructor) return [];
    return courses.filter((course) =>
      course.instructors.some(
        (ins) => ins.name === instructor.name && ins.term === term
      )
    );
  };

  const currentTermHasCourses = getCoursesForTerm(currentTerm).length > 0;

  useEffect(() => {
    if (instructor) {
      if (currentTermHasCourses) {
        setActiveTab(currentTerm);
      } else {
        setActiveTab('all');
      }
    }
  }, [instructor]);

  if (instructor === undefined) return <Loading />;
  if (instructor === null) return <NotFound />;

  const userReview = reviews.find((r) => r.userId === user?.id);

  const reviewCount = reviews.length;
  const reviewLabel = reviewCount === 1 ? 'review' : 'reviews';

  const decodedName = params.name ? decodeURIComponent(params.name) : '';

  const uniqueCourses = courses.filter((course) =>
    course.instructors.some((instructor) => instructor.name === decodedName)
  );

  const activeCourses =
    activeTab === 'all' ? uniqueCourses : getCoursesForTerm(activeTab);

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
            <h1 className='text-3xl font-semibold wrap-break-word text-gray-800 sm:text-4xl dark:text-gray-200'>
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

          <div className='grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-2'>
            <div className='md:col-span-2 lg:col-span-1'>
              <div className='mb-4 flex flex-wrap border-b border-gray-200 dark:border-neutral-700'>
                {orderedTerms.map((term) => {
                  const termCourses = getCoursesForTerm(term);
                  if (termCourses.length === 0) return null;

                  const season = term.split(' ')[0].toLowerCase();
                  const icon =
                    season === 'fall' ? (
                      <Leaf size={14} color='brown' />
                    ) : season === 'winter' ? (
                      <Snowflake size={14} color='skyblue' />
                    ) : (
                      <Sun size={14} color='orange' />
                    );

                  return (
                    <button
                      key={term}
                      onClick={() => setActiveTab(term)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                        activeTab === term
                          ? 'border-b-2 border-gray-800 text-gray-800 dark:border-gray-200 dark:text-gray-200'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {icon}
                      {term} ({termCourses.length})
                    </button>
                  );
                })}
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'border-b-2 border-gray-800 text-gray-800 dark:border-gray-200 dark:text-gray-200'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  All ({uniqueCourses.length})
                </button>
              </div>

              {activeCourses.length > 0 ? (
                <div className='styled-scrollbar grid grid-cols-2 gap-2 overflow-y-scroll md:max-h-72 lg:max-h-44'>
                  {activeCourses.map((course) => (
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
            </div>

            <div className='sm:mt-4 md:mx-auto md:mt-0'>
              {reviewCount !== 0 ? (
                <div>
                  <CourseInfoStats
                    variant='large'
                    reviews={reviews}
                    className='hidden flex-row gap-y-1 sm:flex md:flex-col lg:flex-row lg:gap-x-2'
                  />
                  <CourseInfoStats
                    variant='small'
                    reviews={reviews}
                    className='xs:flex flex-row sm:hidden'
                  />
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
