import { BsSun } from 'react-icons/bs';
import { FaLeaf, FaRegSnowflake } from 'react-icons/fa';

import { classNames, uniqueTermInstructors } from '../lib/utils';
import { Course } from '../model/Course';

const termToIcon = (term: string, variant: 'small' | 'large') => {
  type IconMap = { [key: string]: JSX.Element };
  const size = variant === 'small' ? 20 : 25;

  const icons: IconMap = {
    fall: <FaLeaf size={size} color='Brown' />,
    winter: <FaRegSnowflake size={size} color='SkyBlue' />,
    summer: <BsSun size={size} color='Orange' />,
  };

  return icons[term.split(' ')[0].toLowerCase()];
};

type CourseTermsProps = {
  course: Course;
  variant: 'large' | 'small';
};

export const CourseTerms = ({ course, variant }: CourseTermsProps) => {
  const instructors = uniqueTermInstructors(course);

  return instructors.length !== 0 ? (
    <div
      className={classNames(
        'flex',
        variant === 'small' ? 'space-x-2' : 'space-x-3'
      )}
    >
      {instructors.map((instructor, i) => (
        <div
          key={i}
          className={classNames(
            'rounded-xl bg-gray-100',
            variant === 'small' ? 'py-1 px-2' : 'p-2'
          )}
        >
          <div className='flex items-center space-x-2'>
            {termToIcon(instructor.term, variant)}
            <div>{instructor.name}</div>
          </div>
        </div>
      ))}
    </div>
  ) : null;
};
