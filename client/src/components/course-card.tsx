import { Link } from 'react-router-dom';

import type { Course } from '../lib/types';
import { courseIdToUrlParam, spliceCourseCode } from '../lib/utils';
import { CourseDescription } from './course-description';
import { CourseTerms } from './course-terms';
import { Highlight } from './highlight';

type CourseCardProps = {
  course: Course;
  className: string;
  query?: string;
};

export const CourseCard = ({ course, className, query }: CourseCardProps) => {
  const courseDescriptionShortened =
    course.description.length > 400
      ? course.description.slice(0, 400) + ' ...'
      : course.description;

  return (
    <Link
      to={`/course/${courseIdToUrlParam(course._id)}`}
      key={course._id}
      className={className}
    >
      <div className='max-w-xl rounded-lg bg-slate-50 p-5 duration-150 hover:bg-gray-50 dark:bg-neutral-800'>
        <div className='mb-2 font-bold dark:text-gray-200'>
          {query ? (
            <Highlight
              text={`${spliceCourseCode(course._id, ' ')} - ${course.title}`}
              query={query}
            />
          ) : (
            `${spliceCourseCode(course._id, ' ')} - ${course.title}`
          )}
        </div>
        <CourseTerms course={course} variant='small' query={query} />
        <div className='mt-2 text-gray-600 dark:text-gray-400'>
          <CourseDescription
            description={courseDescriptionShortened}
            query={query}
          />
        </div>
      </div>
    </Link>
  );
};
