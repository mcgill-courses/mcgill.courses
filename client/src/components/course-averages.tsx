import { produce } from 'immer';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import type { Course, Instructor } from '../lib/types';
import { compareTerms } from '../lib/utils';

type Grade = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';

export type TermAverage = {
  term: string;
  average: Grade;
};

type InstructorLinkProps = {
  instructor: Instructor;
};

const InstructorLink = ({ instructor }: InstructorLinkProps) => (
  <Link
    to={`/instructor/${encodeURIComponent(instructor.name)}`}
    className='font-semibold hover:underline'
  >
    {instructor.name}
  </Link>
);

type CourseAveragesProps = {
  course: Course;
  averages: TermAverage[];
};

export const CourseAverages = ({ course, averages }: CourseAveragesProps) => {
  const [showAll, setShowAll] = useState<boolean>(false);

  const termInstructors = groupBy(course.instructors, (i) => i.term);

  const initialExpandedState = () => mapValues(termInstructors, () => false);
  const [expandedState, setExpandedState] = useState(initialExpandedState());

  const handleToggle = (term: string) => {
    setExpandedState(
      produce(expandedState, (draft) => {
        draft[term] = !draft[term];
      })
    );
  };
  useEffect(() => {
    setExpandedState(initialExpandedState());
    setShowAll(false);
  }, [course]);

  return (
    <div
      className={
        'relative w-full rounded-md bg-slate-50 p-6 shadow-sm dark:bg-neutral-800'
      }
    >
      <h2 className='mb-2 mt-1 text-lg font-bold leading-none text-gray-700 dark:text-gray-200 md:text-xl'>
        Class Averages
      </h2>
      <div className='py-1' />

      {averages
        .sort((a, b) => compareTerms(b.term, a.term))
        .slice(0, showAll ? averages.length : 6)
        .map((average) => {
          const instructors = termInstructors[average.term];
          return (
            <Fragment key={average.term}>
              <div className='flex items-center'>
                <div className='w-11/12 text-gray-500 dark:text-gray-400'>
                  <div>
                    <div className='mb-0.5 text-sm'>{average.term}</div>
                    <div className='flex text-xs'>
                      {instructors ? (
                        <div>
                          <InstructorLink instructor={instructors[0]} />
                          {instructors.length > 1 && (
                            <span
                              className='ml-1 cursor-pointer font-semibold dark:text-gray-200'
                              onClick={() => handleToggle(average.term)}
                            >
                              +{instructors.length - 1}
                              <ChevronDown
                                className={twMerge(
                                  'ml-1 inline-block',
                                  expandedState[average.term]
                                    ? 'rotate-180'
                                    : 'rotate-0'
                                )}
                                size={16}
                              />
                            </span>
                          )}
                          <div className='flex flex-col gap-y-0.5'>
                            {expandedState[average.term] && (
                              <>
                                {instructors.slice(1).map((ins) => (
                                  <InstructorLink instructor={ins} />
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>Instructor Unknown</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className='font-medium text-gray-700 dark:text-gray-200'>
                  {average.average}
                </div>
              </div>
              <hr className='my-1 w-full border border-neutral-200 dark:border-neutral-700' />
            </Fragment>
          );
        })}

      <div className='py-1' />

      {averages.length > 6 && (
        <button
          className='flex w-full items-center gap-2 text-sm text-gray-500 dark:text-gray-400 md:text-lg'
          onClick={() => setShowAll(!showAll)}
        >
          <p className='my-auto ml-auto text-base font-medium'>
            {showAll ? 'Show less' : 'Show all'}
          </p>
          {showAll ? (
            <ChevronUp className='my-auto mr-auto font-extrabold' />
          ) : (
            <ChevronDown className='my-auto mr-auto font-extrabold' />
          )}
        </button>
      )}
      <p className='mt-5 text-center text-xs text-gray-700 dark:text-gray-200'>
        Powered by{' '}
        <a href='https://demetrios-koziris.github.io/McGillEnhanced/'>
          <span className='underline'>McGill Enhanced</span>
        </a>
      </p>
    </div>
  );
};
