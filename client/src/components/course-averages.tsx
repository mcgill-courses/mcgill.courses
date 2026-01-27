import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LineChart, List } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import type { TermAverage } from '../lib/term-average';
import type { Course, Instructor } from '../lib/types';
import { compareTerms, groupBy, mapValues } from '../lib/utils';
import { GPAChart } from './gpa-chart';

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
  const [showGraph, setShowGraph] = useState<boolean>(false);

  const termInstructors = groupBy(course.instructors, (i) => i.term);

  const initialExpandedState = () => mapValues(termInstructors, () => false);
  const [expandedState, setExpandedState] = useState(initialExpandedState());

  const handleInstructorToggle = (term: string) => {
    setExpandedState({ ...expandedState, [term]: !expandedState[term] });
  };

  const handleGraphToggle = useCallback(
    () => setShowGraph((prev) => !prev),
    []
  );

  useEffect(() => {
    setExpandedState(initialExpandedState());
    setShowAll(false);
    setShowGraph(false);
  }, [course]);

  const ToggleButtonIcon = showGraph ? List : LineChart;

  return (
    <div
      className={
        'relative w-full rounded-md bg-slate-50 p-6 shadow-sm dark:bg-neutral-800'
      }
    >
      <button
        className='absolute top-4 right-4 z-10 cursor-pointer rounded-full bg-gray-200 p-2 transition duration-150 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600'
        onClick={handleGraphToggle}
      >
        <ToggleButtonIcon
          size={20}
          className='stroke-gray-700 dark:stroke-gray-400'
        />
      </button>

      <h2 className='mt-1 mb-2 text-lg leading-none font-bold text-gray-700 md:text-xl dark:text-gray-200'>
        Class Averages
      </h2>

      {showGraph ? (
        <div className='py-2'>
          <GPAChart averages={averages} termInstructors={termInstructors} />
        </div>
      ) : (
        <>
          <div className='py-1' />

          {(() => {
            const sortedAverages = averages.sort((a, b) =>
              compareTerms(b.term, a.term)
            );
            const firstSix = sortedAverages.slice(0, 6);
            const remaining = sortedAverages.slice(6);

            const renderAverageItem = (average: TermAverage) => {
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
                                  onClick={() =>
                                    handleInstructorToggle(average.term)
                                  }
                                >
                                  +{instructors.length - 1}
                                  <ChevronDown
                                    className={twMerge(
                                      'ml-1 inline-block transition-transform duration-200',
                                      expandedState[average.term]
                                        ? 'rotate-180'
                                        : 'rotate-0'
                                    )}
                                    size={16}
                                  />
                                </span>
                              )}
                              <AnimatePresence initial={false}>
                                {expandedState[average.term] && (
                                  <motion.div
                                    className='flex flex-col gap-y-0.5 overflow-hidden'
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{
                                      duration: 0.2,
                                      ease: 'easeInOut',
                                    }}
                                  >
                                    {instructors.slice(1).map((ins) => (
                                      <InstructorLink
                                        key={ins.name}
                                        instructor={ins}
                                      />
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
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
            };

            return (
              <>
                {firstSix.map(renderAverageItem)}
                <AnimatePresence initial={false}>
                  {showAll && remaining.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className='overflow-hidden'
                    >
                      {remaining.map(renderAverageItem)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            );
          })()}

          <div className='py-1' />

          {averages.length > 6 && (
            <button
              className='flex w-full cursor-pointer items-center gap-2 text-sm text-gray-500 md:text-lg dark:text-gray-400'
              onClick={() => setShowAll(!showAll)}
            >
              <p className='my-auto ml-auto text-base font-medium'>
                {showAll ? 'Show less' : 'Show all'}
              </p>
              <motion.div
                className='my-auto mr-auto'
                animate={{ rotate: showAll ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className='font-extrabold' />
              </motion.div>
            </button>
          )}
        </>
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
