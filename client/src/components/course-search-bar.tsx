import { m } from 'framer-motion';
import { Layers, User } from 'lucide-react';
import { RefObject, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import type { CourseData, SearchResults } from '../lib/search-index';
import { courseIdToUrlParam, spliceCourseCode } from '../lib/utils';
import { Highlight } from './highlight';
import { SearchBar } from './search-bar';

type SearchResultType = 'course' | 'instructor';

type SearchResultProps = {
  index: number;
  query?: string;
  selectedIndex: number;
  text: string;
  type: SearchResultType;
  url?: string;
  onClick?: () => void | Promise<void>;
};

const highlightResultStyle =
  'bg-red-50 border-l-red-500 border-l-4 dark:bg-red-100 dark:border-l-red-600 dark:bg-neutral-600';

const SearchResult = ({
  index,
  query,
  selectedIndex,
  text,
  type,
  url,
  onClick,
}: SearchResultProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const toHighlight = isHovering || selectedIndex === index;

  const icon =
    type === 'course' ? (
      <Layers className='dark:text-gray-200' />
    ) : (
      <User className='dark:text-gray-200' />
    );

  const content = (
    <div
      className={twMerge(
        'flex border-gray-200 p-3 text-left transition-all duration-75 dark:border-neutral-700',
        toHighlight ? highlightResultStyle : 'bg-gray-100 dark:bg-neutral-800'
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className='mr-2 w-6'>{icon}</div>
      <Highlight
        className='dark:text-gray-200'
        query={query?.trim()}
        text={text}
      />
    </div>
  );

  if (!url) {
    return (
      <button
        className='w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-500'
        onClick={() => {
          void onClick?.();
        }}
        type='button'
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={url}
      className='cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-500'
      onClick={() => {
        void onClick?.();
      }}
    >
      {content}
    </Link>
  );
};

const ExploreButton = () => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <Link
      to={`/explore`}
      className='cursor-pointer'
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={twMerge(
          'flex cursor-pointer items-center p-3 text-left transition-all duration-75 dark:border-gray-600 dark:bg-neutral-800 dark:text-gray-200',
          isHovering ? highlightResultStyle : 'bg-gray-100 dark:bg-neutral-800'
        )}
      >
        <Layers className='dark:text-gray-200' />
        <div className='z-50 ml-2 dark:text-gray-200'>Explore all courses</div>
      </div>
    </Link>
  );
};

type CourseSearchBarProps = {
  results: SearchResults;
  handleInputChange: (query: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  inputClassName?: string;
  onCourseSelect?: (
    course: CourseData
  ) => boolean | void | Promise<boolean | void>;
  onResultClick?: () => void;
  placeholder?: string;
  showFocusBorder?: boolean;
  showExploreButton?: boolean;
  showInstructors?: boolean;
};

export const CourseSearchBar = ({
  results,
  handleInputChange,
  inputRef,
  inputClassName,
  onCourseSelect,
  onResultClick,
  placeholder = 'Search by course, subject, or professor',
  showFocusBorder = true,
  showExploreButton = true,
  showInstructors = true,
}: CourseSearchBarProps) => {
  const navigate = useNavigate();

  const [searchSelected, setSearchSelected] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const instructors = showInstructors ? results.instructors : [];
  const length = results.courses.length + instructors.length;
  const showEmptyState =
    Boolean(results.query?.trim()) && length === 0 && !showExploreButton;

  useEffect(() => {
    if (length === 0) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex((index) => Math.min(index, length - 1));
  }, [length]);

  const resetSelection = (query: string) => {
    setSelectedIndex(0);
    handleInputChange(query);
  };

  const selectCourse = async (course: CourseData) => {
    if (onCourseSelect) {
      const selected = await onCourseSelect(course);

      if (selected === false) {
        return false;
      }

      onResultClick?.();
      return true;
    }

    navigate(`/course/${courseIdToUrlParam(course._id)}`);
    onResultClick?.();
    return true;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : length - 1
      );
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prevIndex) =>
        prevIndex < length - 1 ? prevIndex + 1 : 0
      );
    }

    if (selectedIndex > -1 && event.key === 'Enter' && length !== 0) {
      event.preventDefault();
      const input = event.currentTarget;

      if (selectedIndex < results.courses.length) {
        void selectCourse(results.courses[selectedIndex]).then((selected) => {
          if (selected && onResultClick) {
            input.blur();
          }
        });
      } else {
        const instructor = instructors[selectedIndex - results.courses.length];

        if (!instructor) return;

        navigate(`/instructor/${encodeURIComponent(instructor)}`);
        onResultClick?.();

        if (onResultClick) {
          input.blur();
        }
      }
    }
  };

  return (
    <div className='relative'>
      <SearchBar
        value={results.query}
        handleInputChange={resetSelection}
        inputStyle={twMerge(
          'block w-full bg-gray-100 border border-gray-300 shadow-sm p-3 pl-10 text-sm text-black outline-none dark:border-neutral-50 dark:bg-neutral-800 dark:text-gray-200 dark:placeholder:text-neutral-500 lg:min-w-[570px] dark:border-gray-700 rounded-xs',
          searchSelected && showFocusBorder ? 'border-b' : '',
          inputClassName
        )}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        searchSelected={searchSelected}
        setSearchSelected={setSearchSelected}
        inputRef={inputRef}
      />
      {searchSelected &&
        (length > 0 || showExploreButton || showEmptyState) && (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className='absolute top-full z-50 w-full overflow-hidden bg-white shadow-md dark:bg-neutral-800'
            initial={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            {results.courses.map((result, index) => (
              <SearchResult
                index={index}
                query={results.query}
                selectedIndex={selectedIndex}
                text={`${spliceCourseCode(result._id, ' ')} - ${result.title}`}
                type='course'
                url={
                  onCourseSelect
                    ? undefined
                    : `/course/${courseIdToUrlParam(result._id)}`
                }
                key={result._id}
                onClick={
                  onCourseSelect
                    ? async () => {
                        await selectCourse(result);
                      }
                    : onResultClick
                }
              />
            ))}
            {instructors.map((result, index) => (
              <SearchResult
                index={results.courses.length + index}
                query={results.query}
                selectedIndex={selectedIndex}
                text={result}
                type='instructor'
                url={`/instructor/${encodeURIComponent(result)}`}
                key={result + index}
                onClick={onResultClick}
              />
            ))}
            {showEmptyState && (
              <div className='bg-gray-100 p-3 text-left text-sm text-gray-500 dark:bg-neutral-800 dark:text-gray-400'>
                No courses found
              </div>
            )}
            {showExploreButton && <ExploreButton />}
          </m.div>
        )}
    </div>
  );
};
