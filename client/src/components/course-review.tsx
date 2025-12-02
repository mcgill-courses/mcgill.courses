import { Transition } from '@headlessui/react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Check,
  Copy,
  Edit,
  Flame,
  Pin,
  Tag,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

import { useAuth } from '../hooks/use-auth';
import { api } from '../lib/api';
import type { Review } from '../lib/types';
import type { Interaction } from '../lib/types';
import { InteractionKind } from '../lib/types';
import {
  courseIdToUrlParam,
  getReviewAnchorId,
  spliceCourseCode,
} from '../lib/utils';
import { BirdIcon } from './bird-icon';
import { DeleteButton } from './delete-button';
import { IconRating } from './icon-rating';
import { Tooltip } from './tooltip';

// Timestamp of https://github.com/terror/mcgill.courses/pull/500
const RMP_SCRAPE_EPOCH = new Date(1713472800 * 1000);

const LoginPrompt = () => {
  return (
    <div className='absolute bottom-20 end-4 h-fit rounded-md border bg-gray-100 px-2 py-1 text-neutral-800 dark:border-0 dark:bg-neutral-700 dark:text-gray-200 sm:bottom-16'>
      You must be logged in
    </div>
  );
};

type ReviewInteractionsProps = {
  review: Review;
  interactions: Interaction[];
  setPromptLogin: (_: boolean) => void;
  updateLikes: (likes: number) => void;
};

const interactionToNum = (kind: InteractionKind) => {
  return kind === InteractionKind.Like ? 1 : -1;
};

const getLikeChange = (
  before: InteractionKind | undefined | null,
  after: InteractionKind
) => {
  if (!before) return interactionToNum(after);
  if (before === after) return 0;

  return interactionToNum(after) * 2;
};

const ReviewInteractions = ({
  review,
  interactions,
  setPromptLogin,
  updateLikes,
}: ReviewInteractionsProps) => {
  const user = useAuth();

  const getUserInteractionKind = (
    interactions: Interaction[]
  ): InteractionKind | undefined => {
    const interaction = interactions.find(
      (interaction: Interaction) => interaction.userId === review.userId
    );

    return interaction?.kind;
  };

  const [kind, setKind] = useState<InteractionKind | undefined | null>(
    undefined
  );

  useEffect(
    () => setKind(getUserInteractionKind(interactions)),
    [interactions]
  );

  const { courseId, userId, likes } = review;

  const refreshInteractions = async () => {
    try {
      const payload = await api.getInteractions(courseId, userId, user?.id);
      setKind(payload.kind);
    } catch (err: any) {
      toast.error(err.toString());
    }
  };

  const addInteraction = async (interactionKind: InteractionKind) => {
    try {
      await api.addInteraction(interactionKind, courseId, userId, user?.id);
      const change = getLikeChange(kind, interactionKind);
      updateLikes(review.likes + change);

      await refreshInteractions();

      toast.success(
        `Successfully ${interactionKind}d review for ${spliceCourseCode(
          courseId,
          ' '
        )}.`
      );
    } catch (err: any) {
      toast.error(err.toString());
    }
  };

  const removeInteraction = async () => {
    try {
      await api.removeInteraction(courseId, userId, user?.id);
      if (!kind) {
        throw new Error("Can't remove interaction that doesn't exist.");
      }
      updateLikes(review.likes - interactionToNum(kind));

      await refreshInteractions();

      toast.success(
        `Successfully removed interaction for ${spliceCourseCode(
          courseId,
          ' '
        )}.`
      );
    } catch (err: any) {
      toast.error(err.toString());
    }
  };

  const displayLoginPrompt = () => {
    setPromptLogin(true);
    setTimeout(() => setPromptLogin(false), 3000);
  };

  const handleLike = () => {
    user
      ? kind === InteractionKind.Like
        ? removeInteraction()
        : addInteraction(InteractionKind.Like)
      : displayLoginPrompt();
  };

  const handleDislike = () => {
    user
      ? kind === InteractionKind.Dislike
        ? removeInteraction()
        : addInteraction(InteractionKind.Dislike)
      : displayLoginPrompt();
  };

  return (
    <Fragment>
      <div className='mb-0.5 flex items-center'>
        <div className='flex size-8 items-center justify-center rounded-md text-gray-700 focus:outline-none dark:text-white'>
          <ThumbsUp
            onClick={handleLike}
            className={twMerge(
              'h-4 w-4 cursor-pointer stroke-gray-500',
              kind === InteractionKind.Like ? 'stroke-red-600' : ''
            )}
          />
        </div>
        <span className='text-sm font-bold text-gray-700 dark:text-white'>
          {likes}
        </span>
        <div className='flex size-8 items-center justify-center rounded-md text-gray-700 focus:outline-none dark:text-white'>
          <ThumbsDown
            onClick={handleDislike}
            className={twMerge(
              'h-4 w-4 cursor-pointer stroke-gray-500',
              kind === InteractionKind.Dislike ? 'stroke-red-600' : ''
            )}
          />
        </div>
      </div>
    </Fragment>
  );
};

type CourseReviewProps = {
  anchorId?: string;
  attachment?: ReviewAttachment;
  canModify: boolean;
  className?: string;
  handleDelete: () => void;
  highlighted?: boolean;
  includeTaughtBy?: boolean;
  interactions?: Interaction[];
  openEditReview: () => void;
  review: Review;
  showCourse?: boolean;
  updateLikes?: (likes: number) => void;
};

export enum ReviewAttachment {
  ScrollButton = 'scrollButton',
  CopyButton = 'copyButton',
}

export const CourseReview = ({
  anchorId,
  attachment,
  canModify,
  className,
  handleDelete,
  highlighted = false,
  includeTaughtBy = true,
  interactions,
  openEditReview,
  review,
  updateLikes,
}: CourseReviewProps) => {
  const [readMore, setReadMore] = useState(false);
  const [promptLogin, setPromptLogin] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyTimeoutRef = useRef<number | null>(null);

  const date = new Date(parseInt(review.timestamp, 10));

  const shortDate = format(date, 'P'),
    longDate = format(date, 'EEEE, MMMM d, yyyy');

  const highlightAnimation = { scale: highlighted ? 1.05 : 1 };

  const highlightTransition = {
    duration: 0.5,
    ease: [0.22, 1, 0.36, 1],
  } as const;

  const courseRef = (
    <Link
      to={`/course/${courseIdToUrlParam(review.courseId)}`}
      className='font-medium transition hover:text-red-600'
    >
      {review.courseId}
    </Link>
  );

  const copyReviewLink = () => {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !navigator?.clipboard
    ) {
      toast.error('Copy to clipboard is not supported in this browser.');
      return;
    }

    const link = new URL(window.location.href);
    link.searchParams.delete('scrollToReview');
    link.searchParams.set('review', review.userId);

    const copyPromise = navigator.clipboard.writeText(link.toString());

    toast.promise(copyPromise, {
      loading: 'Copying link…',
      success: 'Copied review link to clipboard.',
      error:
        'Something went wrong while copying the review link. Please try again.',
    });

    copyPromise
      .then(() => {
        setCopied(true);

        if (copyTimeoutRef.current) {
          window.clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = window.setTimeout(() => {
          setCopied(false);
          copyTimeoutRef.current = null;
        }, 2000);
      })
      .catch(() => {
        setCopied(false);

        if (copyTimeoutRef.current) {
          window.clearTimeout(copyTimeoutRef.current);
          copyTimeoutRef.current = null;
        }
      });
  };

  const attachmentNode =
    attachment === ReviewAttachment.ScrollButton ? (
      <Tooltip text='Scroll to this review' className='w-36'>
        <Link
          to={`/course/${courseIdToUrlParam(review.courseId)}`}
          state={{ scrollToReview: getReviewAnchorId(review) }}
          className='inline-flex h-6 items-center justify-center text-gray-600 transition-colors duration-200 hover:text-red-600 focus:outline-none disabled:cursor-default disabled:hover:text-gray-600 dark:text-gray-300 dark:hover:text-red-500 dark:disabled:hover:text-gray-300'
          aria-label={`Open ${review.courseId} and scroll to this review`}
        >
          <ArrowUpRight className='h-4 w-4' />
        </Link>
      </Tooltip>
    ) : attachment === ReviewAttachment.CopyButton ? (
      (() => {
        const icon = (
          <span className='relative inline-flex h-4 w-4 items-center justify-center'>
            <Copy
              className={twMerge(
                'absolute h-4 w-4 transition-opacity duration-150 ease-out',
                copied ? 'opacity-0' : 'opacity-100'
              )}
            />
            <Check
              className={twMerge(
                'absolute h-4 w-4 text-green-500 transition-opacity duration-150 ease-out',
                copied ? 'opacity-100' : 'opacity-0'
              )}
            />
          </span>
        );

        const button = (
          <button
            type='button'
            onClick={copyReviewLink}
            className='inline-flex h-6 w-6 items-center justify-center text-gray-600 transition-colors duration-200 hover:text-red-600 focus:outline-none disabled:cursor-default disabled:hover:text-gray-600 dark:text-gray-300 dark:hover:text-red-500 dark:disabled:hover:text-gray-300'
            aria-label={`Copy review link for ${review.courseId}`}
            disabled={copied}
          >
            {icon}
          </button>
        );

        return copied ? (
          button
        ) : (
          <Tooltip text='Copy link to review' className='w-36'>
            {button}
          </Tooltip>
        );
      })()
    ) : null;

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const reviewContext = includeTaughtBy ? (
    <span className='flex flex-wrap items-center gap-x-1 gap-y-1'>
      <span>Taught by</span>
      {review.instructors.map((instructor, i) => {
        let separator = null;

        if (i === review.instructors.length - 2) {
          separator = ' and ';
        } else if (i < review.instructors.length - 2) {
          separator = ', ';
        }

        return (
          <Fragment key={instructor + review.userId}>
            <Link
              to={`/instructor/${encodeURIComponent(instructor)}`}
              className='font-medium transition hover:text-red-600'
            >
              {instructor}
            </Link>
            {separator}
          </Fragment>
        );
      })}
    </span>
  ) : (
    <span className='flex items-center gap-1'>
      <span>Written for</span>
      {courseRef}
    </span>
  );

  return (
    <motion.div
      id={anchorId}
      className={twMerge(
        'relative flex w-full flex-col gap-4 border-b-[1px] border-b-gray-300 bg-slate-50 px-6 py-3 first:rounded-t-md last:rounded-b-md last:border-b-0 dark:border-b-gray-600 dark:bg-neutral-800',
        className
      )}
      animate={highlightAnimation}
      initial={false}
      transition={highlightTransition}
    >
      <div className='flex flex-col'>
        <div className='flex w-full'>
          <div className='relative flex w-full flex-col'>
            <div className='flex w-full'>
              <Tooltip text={longDate} className='w-48'>
                <p className='cursor-default py-2 text-xs font-medium text-gray-700 dark:text-gray-300'>
                  {shortDate}
                </p>
              </Tooltip>
              {date < RMP_SCRAPE_EPOCH && (
                <Tooltip
                  text='External review from RateMyProfessors'
                  className='w-36'
                >
                  <Tag className='ml-2 mt-1 w-4 text-red-600' />
                </Tooltip>
              )}
              {canModify && (
                <Pin
                  size={15}
                  className='ml-2 mt-2 fill-rose-600 text-red-600'
                />
              )}
              <div className='grow' />
              <div className='flex w-64 flex-col items-end rounded-lg p-2'>
                <div className='flex items-center gap-x-2'>
                  <div className='text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                    Rating
                  </div>
                  <IconRating rating={review.rating} icon={BirdIcon} />
                </div>
                <div className='flex items-center gap-x-2'>
                  <div className='text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                    Difficulty
                  </div>
                  <IconRating rating={review.difficulty} icon={Flame} />
                </div>
              </div>
            </div>
            {(() => {
              const newlineCount = (review.content.match(/\n/g) || []).length;
              const visualLength = review.content.length + newlineCount * 50;
              const shouldTruncate = visualLength >= 300 && !readMore;

              if (!shouldTruncate) {
                return (
                  <div className='ml-1 mr-4 mt-2 hyphens-auto whitespace-pre-wrap break-words text-left text-gray-800 dark:text-gray-300'>
                    {review.content}
                  </div>
                );
              }

              let truncateAt = 300;
              const newlineIndex = review.content.indexOf('\n');
              if (newlineIndex !== -1 && newlineIndex < 300) {
                truncateAt = newlineIndex;
              }

              return (
                <>
                  <div className='ml-1 mr-4 mt-2 hyphens-auto whitespace-pre-wrap break-words text-left text-gray-800 dark:text-gray-300'>
                    {review.content.substring(0, truncateAt) + '...'}
                  </div>
                  <button
                    className='ml-1 mr-auto pt-1 text-gray-700 underline transition duration-300 ease-in-out hover:text-red-500 dark:text-gray-300 dark:hover:text-red-500'
                    onClick={() => setReadMore(true)}
                  >
                    Show more
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>
      <div className='flex items-center'>
        <p className='mb-2 mt-auto flex-1 text-sm italic leading-4 text-gray-700 dark:text-gray-200'>
          <span className='inline-flex flex-wrap items-center gap-1'>
            {reviewContext}
            {attachmentNode}
          </span>
        </p>
        <Transition
          show={promptLogin}
          enter='transition-opacity duration-150'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='transition-opacity duration-150'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <LoginPrompt />
        </Transition>
        <div className='flex items-center'>
          <div className='mb-1 flex'>
            {canModify && (
              <div className='ml-2 mr-1 flex h-fit space-x-2'>
                <div onClick={openEditReview}>
                  <Edit
                    className='cursor-pointer stroke-gray-500 transition duration-200 hover:stroke-gray-800 dark:stroke-gray-400 dark:hover:stroke-gray-200'
                    size={20}
                  />
                </div>
                <DeleteButton
                  title='Delete Review'
                  text={`Are you sure you want to delete your review of ${review.courseId}? `}
                  onConfirm={handleDelete}
                  size={20}
                />
              </div>
            )}
          </div>
          {updateLikes && interactions && (
            <ReviewInteractions
              review={review}
              interactions={interactions}
              setPromptLogin={setPromptLogin}
              updateLikes={updateLikes}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};
