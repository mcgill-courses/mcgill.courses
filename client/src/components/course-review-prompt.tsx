type CourseReviewPromptProps = {
  openAddReview: () => void;
};

export const CourseReviewPrompt = ({
  openAddReview,
}: CourseReviewPromptProps) => {
  return (
    <div className='flex h-fit justify-between rounded-md px-3 py-2 dark:bg-neutral-900'>
      <p className='my-auto text-sm sm:text-base dark:text-gray-200'>
        Taken this course?{' '}
      </p>
      <button
        className='cursor-pointer rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white transition duration-200 hover:bg-red-600 sm:text-base'
        onClick={openAddReview}
      >
        Leave a review
      </button>
    </div>
  );
};
