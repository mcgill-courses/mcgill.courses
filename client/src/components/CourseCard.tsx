import { Link } from 'react-router-dom';

import { Course } from '../model/Course';
import { CourseTerms } from './CourseTerms';

type CourseCardProps = {
  course: Course;
};

export const CourseCard = ({ course }: CourseCardProps) => {
  return (
    <Link to={`/course/${course._id}`} key={course._id}>
      <div className='bg m-2 max-w-xl rounded-lg bg-slate-50 p-5 duration-150 hover:bg-gray-50 dark:bg-neutral-800'>
        <div className='mb-2 font-bold dark:text-gray-200'>
          {course._id} - {course.title}
        </div>
        <CourseTerms course={course} variant='small' />
        <div className='mt-4 text-gray-600 dark:text-gray-400'>
          {course.description}
        </div>
      </div>
    </Link>
  );
};
