import { produce } from 'immer';
import { ChevronDown } from 'lucide-react';
import { Leaf, Snowflake, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import type { Course } from '../lib/types';
import {
  compareTerms,
  getCurrentTerms,
  groupCurrentCourseTermInstructors,
} from '../lib/utils';
import { Highlight } from './highlight';
import { Tooltip } from './tooltip';

const variantToSize = (variant: 'small' | 'large') => {
  return variant === 'small' ? 20 : 18;
};

type SeasonIconProps = {
  variant: 'small' | 'large';
  term: string;
};

const SeasonIcon = ({ variant, term }: SeasonIconProps) => {
  const size = variantToSize(variant);

  const season = term.split(' ')[0].toLowerCase();

  const icons: Record<string, JSX.Element> = {
    fall: <Leaf size={size} color='brown' />,
    winter: <Snowflake size={size} color='skyblue' />,
    summer: <Sun size={size} color='orange' />,
  };

  const icon = icons[season];

  if (variant === 'large') {
    return (
      <Tooltip text={term}>
        <div>{icon}</div>
      </Tooltip>
    );
  }

  return <div>{icon}</div>;
};

export const termColorMap: Record<string, string> = {
  fall: 'bg-red-100 text-red-900',
  winter: 'bg-sky-100 text-sky-900',
  summer: 'bg-yellow-100 text-yellow-900',
};

type CourseTermsProps = {
  course: Course;
  variant: 'large' | 'small';
  query?: string;
};

export const CourseTerms = ({ course, variant, query }: CourseTermsProps) => {
  const instructorGroups = groupCurrentCourseTermInstructors(course);

  const initialExpandedState = () =>
    Object.entries(instructorGroups).map(() => false);

  const [expandedState, setExpandedState] = useState(initialExpandedState());

  const handleToggle = (i: number) => {
    setExpandedState(
      produce(expandedState, (draft) => {
        draft[i] = !draft[i];
      })
    );
  };

  useEffect(() => {
    setExpandedState(initialExpandedState());
  }, [course]);

  const currentlyOfferedTerms = course.terms.filter((c) =>
    getCurrentTerms().includes(c)
  );

  if (currentlyOfferedTerms.length === 0)
    return (
      <div className='my-1.5 w-fit text-sm'>
        <div className='rounded-xl bg-gray-200 p-1 dark:bg-neutral-700'>
          <div className='flex items-center space-x-1'>
            <X
              size={variantToSize(variant)}
              className='text-gray-700 dark:text-gray-200'
            />
            <div className='pr-1 font-medium text-gray-800 dark:text-gray-200'>
              Not Offered
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className='mr-auto flex flex-wrap gap-x-2'>
      {Object.entries(instructorGroups)
        .sort((a, b) => compareTerms(a[0], b[0]))
        .map(([term, instructors], i) => {
          const season = term.split(' ')[0].toLowerCase();
          return (
            <div className='relative' key={term}>
              <div
                className={twMerge(
                  'my-1.5 flex text-sm dark:bg-neutral-700',
                  variant === 'small' ? 'px-2 py-1' : 'max-w-fit px-2 py-1',
                  termColorMap[season],
                  expandedState[i] ? 'rounded-xl' : 'rounded-full'
                )}
              >
                {instructors.length > 0 ? (
                  <div className='flex flex-col gap-y-1'>
                    {(expandedState[i]
                      ? instructors
                      : instructors.slice(0, 1)
                    ).map((ins) => (
                      <Link
                        key={ins.name}
                        to={`/instructor/${encodeURIComponent(ins.name)}`}
                      >
                        <div className='flex items-center space-x-1.5 whitespace-nowrap'>
                          <SeasonIcon term={term} variant={variant} />
                          <div className='pr-1 font-medium dark:text-gray-200'>
                            <Highlight
                              text={ins.name}
                              query={query || undefined}
                            />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className='flex items-center space-x-1.5 whitespace-nowrap'>
                    <SeasonIcon term={term} variant={variant} />
                    <div className={'pr-1 font-medium dark:text-gray-200'}>
                      No Instructor Assigned
                    </div>
                  </div>
                )}
                {instructors.length > 1 && (
                  <span
                    className='cursor-pointer font-semibold dark:text-gray-200'
                    onClick={() => handleToggle(i)}
                  >
                    +{instructors.length - 1}
                    {variant === 'large' && (
                      <ChevronDown
                        className={twMerge(
                          'ml-1 inline-block',
                          expandedState[i] ? 'rotate-180' : 'rotate-0'
                        )}
                        size={16}
                      />
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
};
