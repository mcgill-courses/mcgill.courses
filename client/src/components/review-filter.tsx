import uniq from 'lodash/uniq';
import { Dispatch, SetStateAction, useEffect, useMemo, useRef } from 'react';

import type { Review } from '../lib/types';
import type { Course } from '../lib/types';
import { Autocomplete } from './autocomplete';
import { ResetButton } from './reset-button';

const sortTypes = [
  'Most Recent',
  'Least Recent',
  'Highest Rating',
  'Lowest Rating',
  'Hardest',
  'Easiest',
  'Most Liked',
  'Most Disliked',
] as const;

export type ReviewSortType = (typeof sortTypes)[number];

type ReviewFilterProps = {
  course: Course;
  allReviews: Review[];
  sortBy: ReviewSortType;
  selectedInstructor: string;
  setReviews: Dispatch<SetStateAction<Review[]>>;
  setShowAllReviews: Dispatch<SetStateAction<boolean>>;
  setSelectedInstructor: Dispatch<SetStateAction<string>>;
  setSortBy: Dispatch<SetStateAction<ReviewSortType>>;
};

export const ReviewFilter = ({
  course,
  allReviews,
  sortBy,
  selectedInstructor,
  setReviews,
  setShowAllReviews,
  setSortBy,
  setSelectedInstructor,
}: ReviewFilterProps) => {
  const previousSortRef = useRef<ReviewSortType>(sortBy);
  const previousInstructorRef = useRef<string>(selectedInstructor);

  useEffect(() => {
    setReviews(
      allReviews
        .filter(
          (review: Review) =>
            selectedInstructor === '' ||
            review.instructors
              .map((ins) => ins.toLowerCase())
              .includes(selectedInstructor.toLowerCase())
        )
        .sort((a: Review, b: Review) => {
          switch (sortBy) {
            case 'Most Recent':
              return parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10);
            case 'Least Recent':
              return parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10);
            case 'Highest Rating':
              return b.rating - a.rating;
            case 'Lowest Rating':
              return a.rating - b.rating;
            case 'Hardest':
              return b.difficulty - a.difficulty;
            case 'Easiest':
              return a.difficulty - b.difficulty;
            case 'Most Liked':
              return b.likes - a.likes;
            case 'Most Disliked':
              return a.likes - b.likes;
            default:
              return parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10);
          }
        })
    );

    const sortChanged = previousSortRef.current !== sortBy;

    const instructorChanged =
      previousInstructorRef.current !== selectedInstructor;

    if (sortChanged || instructorChanged) {
      setShowAllReviews(false);
    }

    previousSortRef.current = sortBy;
    previousInstructorRef.current = selectedInstructor;
  }, [sortBy, selectedInstructor, allReviews]);

  const reset = () => {
    setSortBy('Most Recent');
    setSelectedInstructor('');
  };

  useEffect(reset, [course]);

  const sorts = useMemo(() => sortTypes.slice(), []);
  const uniqueInstructors = uniq(course.instructors.map((ins) => ins.name));

  return (
    <div className='rounded-lg dark:bg-neutral-900 dark:text-gray-200'>
      <div className='xs:mt-0 xs:flex xs:items-center relative mt-6'>
        <div className='p-1'>
          <div className='flex max-w-sm gap-x-2'>
            <div className='xs:max-w-56 w-2/5'>
              <h2 className='mb-2 text-sm font-medium text-gray-600 dark:text-gray-400'>
                Sort By
              </h2>
              <div className='relative z-10'>
                <Autocomplete
                  options={sorts}
                  value={sortBy}
                  setValue={(val: string) => setSortBy(val as ReviewSortType)}
                />
              </div>
            </div>
            <div className='xs:w-auto w-3/5'>
              <h2 className='mb-2 text-sm font-medium text-gray-600 dark:text-gray-400'>
                Instructor
              </h2>
              <div className='relative z-10'>
                <Autocomplete
                  options={uniqueInstructors}
                  value={selectedInstructor}
                  setValue={setSelectedInstructor}
                />
              </div>
            </div>
          </div>
        </div>
        <ResetButton
          className='xs:static xs:mt-6 absolute -top-2 right-2'
          onClear={reset}
        />
      </div>
    </div>
  );
};
