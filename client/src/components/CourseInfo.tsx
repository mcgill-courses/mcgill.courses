import { ExternalLink } from 'react-feather';

import { Course } from '../model/Course';
import { CourseTerms } from './CourseTerms';
import { RatingPieChart } from './RatingPieChart';

type CourseInfoProps = {
  course: Course;
  rating: number;
  numReviews: number;
};

export const CourseInfo = ({ course, rating, numReviews }: CourseInfoProps) => {
  return (
    <div className='flex justify-center'>
      <div className='mx-8 flex w-screen flex-row rounded-md bg-slate-50 p-6 dark:bg-neutral-800 md:mt-10'>
        <div className='flex flex-col md:flex-row'>
          <div className='m-4 flex w-fit flex-col space-y-3 md:m-4 md:w-1/2'>
            <div className='flex flex-row space-x-2 align-middle'>
              <h1 className='break-words text-4xl font-semibold text-gray-800 dark:text-gray-200'>
                {course._id}
              </h1>
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
            <h2 className='text-3xl text-gray-800 dark:text-gray-200'>
              {course.title}
            </h2>
            <CourseTerms course={course} variant='large' />
            <p className='break-words text-gray-500 dark:text-gray-400'>
              {course.description}
            </p>
          </div>
          <div className='m-4 mx-auto flex w-fit flex-col items-center justify-center space-y-3  md:m-4 md:w-1/2'>
            <div className='w-full lg:w-3/4'>
              {numReviews > 0 ? (
                <RatingPieChart
                  title={course.title}
                  rating={rating}
                  numReviews={numReviews}
                />
              ) : (
                <div className='text-center text-gray-700 dark:text-gray-200'>
                  No reviews have been left for this course yet. Be the first!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
