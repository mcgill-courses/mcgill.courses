import { List, Network } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import { capitalize, punctuate, stripColonPrefix } from '../lib/utils';
import type { Course } from '../model/course';
import { CourseGraph } from './course-graph';

type RequirementTextProps = {
  text: string;
};

const RequirementText = ({ text }: RequirementTextProps) => {
  const nodes = useMemo(() => {
    const fragments: React.ReactNode[] = [];

    const regex = /\b([A-Z]{4})\s?(\d{3})([A-Za-z]\d?)?\b/g;

    let lastIndex = 0;

    text.replace(regex, (match, code, number, level, index) => {
      if (index > lastIndex) fragments.push(text.substring(lastIndex, index));

      const courseLink = level
        ? `${code}-${number}${level}`
        : `${code}-${number}`;

      fragments.push(
        <Link
          key={`course-${index}`}
          to={`/course/${courseLink}`}
          className='text-gray-800 hover:underline dark:text-gray-200'
        >
          {`${code} ${number}${level ? level : ''}`}
        </Link>
      );

      lastIndex = index + match.length;

      return match;
    });

    if (lastIndex < text.length) fragments.push(text.substring(lastIndex));

    return fragments;
  }, [text]);

  return <>{nodes}</>;
};

type RequirementBlockProps = {
  title: string;
  text?: string;
};

const RequirementBlock = ({ title, text }: RequirementBlockProps) => {
  return (
    <div>
      <h2 className='mb-2 mt-1 text-xl font-bold leading-none text-gray-700 dark:text-gray-200'>
        {title}
      </h2>
      {text ? (
        <div className='text-gray-500 dark:text-gray-400'>
          <RequirementText
            text={capitalize(punctuate(stripColonPrefix(text.trim())))}
          />
        </div>
      ) : (
        <p className='text-gray-500 dark:text-gray-400'>
          This course has no {title.toLowerCase()}.
        </p>
      )}
    </div>
  );
};

type RequirementsProps = {
  className?: string;
  course: Course;
};

export const CourseRequirements = ({
  className,
  course,
}: RequirementsProps) => {
  const [showGraph, setShowGraph] = useState(false);

  const handleGraphToggle = useCallback(
    () => setShowGraph((prev) => !prev),
    [setShowGraph]
  );

  const ToggleButtonIcon = showGraph ? List : Network;

  return (
    <div
      className={twMerge(
        'relative w-full rounded-md bg-slate-50 shadow-sm dark:bg-neutral-800',
        className
      )}
    >
      <button
        className='absolute right-4 top-4 z-10 cursor-pointer rounded-full bg-gray-200 p-2 transition duration-150 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600'
        onClick={handleGraphToggle}
      >
        <ToggleButtonIcon
          size={28}
          className='stroke-gray-700 dark:stroke-gray-400'
        />
      </button>
      {!showGraph ? (
        <div className='space-y-7 p-6'>
          <RequirementBlock
            title='Prerequisites'
            text={course.prerequisitesText}
          />
          <RequirementBlock
            title='Corequisites'
            text={course.corequisitesText}
          />
          <RequirementBlock title='Restrictions' text={course.restrictions} />
        </div>
      ) : (
        <CourseGraph course={course} />
      )}
    </div>
  );
};
