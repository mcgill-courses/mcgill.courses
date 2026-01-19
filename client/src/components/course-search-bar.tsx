import { Layers, User } from 'lucide-react';
import { RefObject, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import type { SearchResults } from '../lib/search-index';
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
  url: string;
  onClick?: () => void;
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

  return (
    <Link
      to={url}
      className='cursor-pointer'
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={onClick}
    >
      <div
        className={twMerge(
          'flex border-gray-200 p-3 text-left transition-all duration-75 dark:border-neutral-700',
          toHighlight ? highlightResultStyle : 'bg-gray-100 dark:bg-neutral-800'
        )}
        key={index}
      >
        <div className='mr-2 w-6'>{icon}</div>
        <Highlight
          className='dark:text-gray-200'
          query={query?.trim()}
          text={text}
        />
      </div>
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
  onResultClick?: () => void;
  inputRef?: RefObject<HTMLInputElement>;
};

export const CourseSearchBar = ({
  results,
  handleInputChange,
  onResultClick,
  inputRef,
}: CourseSearchBarProps) => {
  const navigate = useNavigate();

  const [searchSelected, setSearchSelected] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const length = results.courses.length + results.instructors.length;

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
      navigate(
        selectedIndex < results.courses.length
          ? `/course/${courseIdToUrlParam(results.courses[selectedIndex]._id)}`
          : `/instructor/${encodeURIComponent(
              results.instructors[selectedIndex - results.courses.length]
            )}`
      );

      if (onResultClick) {
        onResultClick();
        event.currentTarget.blur();
      }
    }
  };

  return (
    <div className='relative'>
      <SearchBar
        value={results.query}
        handleInputChange={handleInputChange}
        inputStyle={twMerge(
          'block w-full bg-gray-100 border border-gray-300 shadow-sm p-3 pl-10 text-sm text-black outline-none dark:border-neutral-50 dark:bg-neutral-800 dark:text-gray-200 dark:placeholder:text-neutral-500 lg:min-w-[570px] dark:border-gray-700 rounded-xs',
          searchSelected ? 'border-b' : ''
        )}
        onKeyDown={handleKeyDown}
        placeholder='Search for courses, subjects or professors'
        searchSelected={searchSelected}
        setSearchSelected={setSearchSelected}
        inputRef={inputRef}
      />
      {searchSelected && (
        <div className='absolute top-full z-50 w-full overflow-hidden bg-white shadow-md dark:bg-neutral-800'>
          {results.courses.map((result, index) => (
            <SearchResult
              index={index}
              query={results.query}
              selectedIndex={selectedIndex}
              text={`${spliceCourseCode(result._id, ' ')} - ${result.title}`}
              type='course'
              url={`/course/${courseIdToUrlParam(result._id)}`}
              key={result._id}
              onClick={onResultClick}
            />
          ))}
          {results.instructors.map((result, index) => (
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
          <ExploreButton />
        </div>
      )}
    </div>
  );
};
