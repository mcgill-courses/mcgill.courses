import { useCallback, useState } from 'react';
import { FiList } from 'react-icons/fi';
import { PiGraphFill } from 'react-icons/pi';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import { capitalize, punctuate } from '../lib/utils';
import type { Course } from '../model/Course';
import type { Requirements } from '../model/Requirements';
import { CourseGraph } from './CourseGraph';

type Transform = 'text' | 'html';

const transformHtml = (html: string): React.ReactNode[] => {
  const text = html.substring(html.indexOf(':') + 1);

  const doc = new DOMParser().parseFromString(
    capitalize(punctuate(text.trim())),
    'text/html'
  );

  return Array.from(doc.body.childNodes).map((node, index) => {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE: {
        const elem = node as HTMLElement;

        if (node.nodeName === 'A') {
          const href = elem.getAttribute('href');

          if (!href) return elem.innerText;

          const courseMatch = href.match(/courses\/(.+)-(.+)/);

          if (!courseMatch) return <a href={href}>{elem.innerText}</a>;

          const courseCode = `${courseMatch[1]}-${courseMatch[2]}`;

          return (
            <Link
              key={index}
              to={`/course/${courseCode}`}
              className='text-gray-800 hover:underline dark:text-gray-200'
            >
              {elem.innerText}
            </Link>
          );
        }

        return <span key={index}>{(node as HTMLElement).innerText}</span>;
      }
      case Node.TEXT_NODE:
        return <span key={index}>{(node as Text).textContent}</span>;
      case Node.COMMENT_NODE:
        return null;
    }
  });
};

const transformText = (text: string): React.ReactNode[] => {
  const nodes = [],
    regex = /\b([A-Z]{4})\s(\d{3})([A-Za-z]\d?)?\b/g;

  let lastIndex = 0;

  text.replace(regex, (match, code, number, level, index) => {
    if (index > lastIndex) nodes.push(text.substring(lastIndex, index));

    const courseLink = level
      ? `${code}-${number}${level}`
      : `${code}-${number}`;

    nodes.push(
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

  if (lastIndex < text.length) nodes.push(text.substring(lastIndex));

  return nodes;
};

type RequirementBlockProps = {
  title: string;
  text?: string;
  transform: Transform;
};

const RequirementBlock = ({
  title,
  text,
  transform,
}: RequirementBlockProps) => {
  return (
    <div>
      <h2 className='mb-2 mt-1 text-xl font-bold leading-none text-gray-700 dark:text-gray-200'>
        {title}
      </h2>
      {text ? (
        <div className='text-gray-500 dark:text-gray-400'>
          {transform == 'html'
            ? transformHtml(text)
            : transformText(capitalize(punctuate(text.trim())))}
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
  course: Course;
  requirements: Requirements;
  className?: string;
};

export const CourseRequirements = ({
  course,
  requirements,
  className,
}: RequirementsProps) => {
  const [showGraph, setShowGraph] = useState(false);

  const handleGraphToggle = useCallback(
    () => setShowGraph((prev) => !prev),
    [setShowGraph]
  );

  const ToggleButtonIcon = showGraph ? FiList : PiGraphFill;

  return (
    <div
      className={twMerge(
        'relative w-full rounded-md bg-slate-50 shadow-sm dark:bg-neutral-800',
        className
      )}
    >
      <button
        className='absolute right-4 top-4 z-10 cursor-pointer rounded-full bg-gray-200 p-1.5 transition duration-150 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600'
        onClick={handleGraphToggle}
      >
        <ToggleButtonIcon
          size={28}
          className='fill-gray-700 stroke-gray-700 dark:fill-gray-400 dark:stroke-gray-400'
        />
      </button>
      {!showGraph ? (
        <div className='space-y-7 p-6'>
          <RequirementBlock
            title='Prerequisites'
            text={requirements.prerequisitesText}
            transform='html'
          />
          <RequirementBlock
            title='Corequisites'
            text={requirements.corequisitesText}
            transform='html'
          />
          <RequirementBlock
            title='Restrictions'
            text={requirements.restrictions}
            transform='text'
          />
        </div>
      ) : (
        <CourseGraph course={course} />
      )}
    </div>
  );
};
