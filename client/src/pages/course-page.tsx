import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { AddReviewForm } from '../components/add-review-form';
import { CourseAverages } from '../components/course-averages';
import { CourseInfo } from '../components/course-info';
import { CourseRequirements } from '../components/course-requirements';
import { CourseReview, ReviewAttachment } from '../components/course-review';
import { CourseReviewPrompt } from '../components/course-review-prompt';
import { CourseSchedule } from '../components/course-schedule';
import { EditReviewForm } from '../components/edit-review-form';
import { FinalExamRow } from '../components/final-exam-row';
import { Layout } from '../components/layout';
import { NotFound } from '../components/not-found';
import { ReviewEmptyPrompt } from '../components/review-empty-prompt';
import { ReviewFilter, ReviewSortType } from '../components/review-filter';
import { useAuth } from '../hooks/use-auth';
import { api } from '../lib/api';
import type { Course, CourseAverage, Interaction, Review } from '../lib/types';
import { getCurrentTerms, getReviewAnchorId } from '../lib/utils';
import { Loading } from './loading';

export const CoursePage = () => {
  const currentTerms = getCurrentTerms();
  const firstFetch = useRef(true);
  const hasAttemptedScroll = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);
  const lastScrollTarget = useRef<string | null>(null);
  const location = useLocation();
  const params = useParams<{ id: string }>();
  const scrollToReviewId = useRef<string | null>(null);
  const user = useAuth();

  const [addReviewOpen, setAddReviewOpen] = useState(false);
  const [allReviews, setAllReviews] = useState<Review[] | undefined>(undefined);
  const [course, setCourse] = useState<Course | null | undefined>(undefined);
  const [courseAverages, setCourseAverages] = useState<CourseAverage[]>([]);
  const [editReviewOpen, setEditReviewOpen] = useState(false);
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(
    null
  );
  const [interactions, setInteractions] = useState<Interaction[] | undefined>(
    []
  );
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showingReviews, setShowingReviews] = useState<Review[]>([]);
  const [sortBy, setSortBy] = useState<ReviewSortType>('Most Recent');

  useEffect(() => {
    firstFetch.current = true;
    setShowAllReviews(false);
    lastScrollTarget.current = null;
  }, [params.id]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const reviewParam = searchParams.get('review');

    if (reviewParam && lastScrollTarget.current !== reviewParam) {
      scrollToReviewId.current = `review-${reviewParam}`;
      hasAttemptedScroll.current = false;
      lastScrollTarget.current = reviewParam;
    }
  }, [location.search]);

  const refetch = () => {
    const id = params.id?.replace('-', '').toUpperCase();

    const inner = async () => {
      try {
        const payload = await api.getCourseById(id);

        if (payload === null) {
          setCourse(null);
          return;
        }

        if (firstFetch.current) setCourse(payload.course);

        setShowingReviews(payload.reviews);
        setAllReviews(payload.reviews);
        setCourseAverages(payload.courseAverages);

        if (user && id) {
          const courseInteractionsPayload =
            await api.getUserInteractionsForCourse(id);

          setInteractions(courseInteractionsPayload.interactions);
        }

        firstFetch.current = false;
      } catch {
        toast.error(
          'An error occurred while trying to fetch course information'
        );
      }
    };

    inner();
  };

  useEffect(refetch, [params.id]);

  useEffect(() => {
    if (hasAttemptedScroll.current) return;

    const anchor = scrollToReviewId.current;

    if (!anchor || !allReviews || allReviews.length === 0) return;

    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const prefix = mediaQuery.matches ? 'desktop' : 'mobile';
    const elementId = `${prefix}-${anchor}`;
    const element = document.getElementById(elementId);

    if (!element) {
      if (!showAllReviews) {
        setShowAllReviews(true);
        return;
      }

      hasAttemptedScroll.current = true;
      scrollToReviewId.current = null;

      return;
    }

    hasAttemptedScroll.current = true;
    scrollToReviewId.current = null;

    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setHighlightedReviewId(elementId);

      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }

      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedReviewId(null);
        highlightTimeoutRef.current = null;
      }, 1600);
    });
  }, [allReviews, showAllReviews]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  if (course === null) {
    return (
      <Layout>
        <NotFound />
      </Layout>
    );
  }

  if (course === undefined || showingReviews === undefined) {
    return <Loading />;
  }

  if (course.terms.some((term) => !currentTerms.includes(term))) {
    setCourse({
      ...course,
      terms: course.terms.filter((term) => currentTerms.includes(term)),
    });
  }

  const userReview = showingReviews?.find((r) => r.userId === user?.id);

  const canReview = Boolean(
    user && !allReviews?.find((r) => r.userId === user?.id)
  );

  const handleSubmit = (successMessage: string) => {
    return (res: Response) => {
      if (res.ok) {
        toast.success(successMessage);
        setAddReviewOpen(false);
        refetch();
      } else {
        toast.error('An error occurred');
      }
    };
  };

  const handleDelete = async (review: Review) => {
    const res = await api.deleteReview(review.courseId);

    if (res.ok) {
      setShowingReviews(
        showingReviews.filter((r) => r.userId !== review.userId)
      );
      setAllReviews(
        allReviews?.filter(
          (r) => r.userId !== review.userId && r.courseId === review.courseId
        )
      );
    }

    handleSubmit('Review deleted successfully')(res);

    localStorage.removeItem(course._id);
  };

  const updateLikes = (review: Review) => {
    return (likes: number) => {
      if (allReviews) {
        const updated = allReviews.slice();
        const r = updated.find(
          (r) => r.courseId == review.courseId && r.userId == review.userId
        );

        if (r === undefined) {
          toast.error("Can't update likes for review that doesn't exist");
          return;
        }

        r.likes = likes;
        setAllReviews(updated);
      }
    };
  };

  return (
    <Layout>
      <Helmet>
        <title>
          {course._id} - {course.title} - mcgill.courses
        </title>
        <meta name='description' content={course.description} />

        <meta property='og:type' content='website' />
        <meta
          property='og:url'
          content={`https://mcgill.courses/${course._id}`}
        />
        <meta
          property='og:title'
          content={`${course._id}- ${course.title} - mcgill.courses`}
        />
        <meta property='og:description' content={course.description} />

        <meta
          property='twitter:url'
          content={`https://mcgill.courses/${course._id}`}
        />
        <meta
          property='twitter:title'
          content={`${course._id}- ${course.title} - mcgill.courses`}
        />
        <meta property='twitter:description' content={course.description} />
      </Helmet>

      <div className='mx-auto mt-10 max-w-6xl md:mt-0'>
        <CourseInfo course={course} reviews={showingReviews} />
        <div className='py-2.5' />
        <div className='hidden gap-x-6 lg:grid lg:grid-cols-5'>
          <div className='col-span-3'>
            <FinalExamRow course={course} className='mb-4' />
            <CourseSchedule
              course={course}
              className={canReview ? 'mb-4' : ''}
            />
            {canReview && (
              <CourseReviewPrompt
                openAddReview={() => setAddReviewOpen(true)}
              />
            )}
            <div className='py-2' />
            {allReviews && allReviews.length > 0 ? (
              <div className='mb-2'>
                <ReviewFilter
                  course={course}
                  allReviews={allReviews ?? []}
                  setReviews={setShowingReviews}
                  setShowAllReviews={setShowAllReviews}
                  sortBy={sortBy}
                  selectedInstructor={selectedInstructor}
                  setSortBy={setSortBy}
                  setSelectedInstructor={setSelectedInstructor}
                />
              </div>
            ) : (
              <ReviewEmptyPrompt className='my-8'>
                No reviews have been left for this course yet, be the first!
              </ReviewEmptyPrompt>
            )}
            <div className='w-full shadow-sm'>
              {userReview &&
                (() => {
                  const desktopAnchorId = `desktop-${getReviewAnchorId(userReview)}`;

                  return (
                    <CourseReview
                      anchorId={desktopAnchorId}
                      highlighted={highlightedReviewId === desktopAnchorId}
                      canModify={Boolean(user && userReview.userId === user.id)}
                      handleDelete={() => handleDelete(userReview)}
                      openEditReview={() => setEditReviewOpen(true)}
                      review={userReview}
                      interactions={interactions}
                      attachment={ReviewAttachment.CopyButton}
                      updateLikes={updateLikes(userReview)}
                    />
                  );
                })()}
              {showingReviews.length > 0
                ? showingReviews
                    .filter((review) =>
                      user ? review.userId !== user.id : true
                    )
                    .slice(0, showAllReviews ? showingReviews.length : 8)
                    .map((review) => {
                      const desktopAnchorId = `desktop-${getReviewAnchorId(review)}`;

                      return (
                        <CourseReview
                          anchorId={desktopAnchorId}
                          highlighted={highlightedReviewId === desktopAnchorId}
                          canModify={Boolean(user && review.userId === user.id)}
                          interactions={interactions}
                          handleDelete={() => handleDelete(review)}
                          key={desktopAnchorId}
                          openEditReview={() => setEditReviewOpen(true)}
                          review={review}
                          attachment={ReviewAttachment.CopyButton}
                          updateLikes={updateLikes(review)}
                        />
                      );
                    })
                : allReviews &&
                  allReviews.length > 0 && (
                    <ReviewEmptyPrompt className='my-8'>
                      No reviews have been left for this course with this
                      instructor yet.
                    </ReviewEmptyPrompt>
                  )}
            </div>
            {!showAllReviews && showingReviews.length > 8 && (
              <div className='flex justify-center text-gray-400 dark:text-neutral-500'>
                <button
                  className='size-full border border-dashed border-neutral-400 py-2 dark:border-neutral-500'
                  onClick={() => setShowAllReviews(true)}
                >
                  Show all {showingReviews.length} reviews
                </button>
              </div>
            )}
          </div>

          <div className='col-span-2 flex flex-col gap-5'>
            <CourseRequirements course={course} />
            {courseAverages && courseAverages.length >= 1 && (
              <CourseAverages course={course} averages={courseAverages} />
            )}
          </div>
        </div>
        <div className='flex flex-col lg:hidden'>
          <div className='mb-4 flex'>
            <CourseRequirements course={course} />
          </div>

          <div className='mb-4 flex'>
            {courseAverages && courseAverages.length >= 1 && (
              <CourseAverages course={course} averages={courseAverages} />
            )}
          </div>
          <FinalExamRow course={course} className='mb-4' />
          <CourseSchedule course={course} />
          <div className='mt-4 flex w-full flex-row justify-between'>
            <div className='w-full'>
              {canReview && (
                <CourseReviewPrompt
                  openAddReview={() => setAddReviewOpen(true)}
                />
              )}
              {allReviews && allReviews.length > 0 ? (
                <div className='my-2'>
                  <ReviewFilter
                    course={course}
                    allReviews={allReviews ?? []}
                    setReviews={setShowingReviews}
                    setShowAllReviews={setShowAllReviews}
                    sortBy={sortBy}
                    selectedInstructor={selectedInstructor}
                    setSortBy={setSortBy}
                    setSelectedInstructor={setSelectedInstructor}
                  />
                </div>
              ) : (
                <ReviewEmptyPrompt className='my-8'>
                  No reviews have been left for this course yet, be the first!
                </ReviewEmptyPrompt>
              )}
              <div className='w-full shadow-sm'>
                {userReview &&
                  (() => {
                    const mobileAnchorId = `mobile-${getReviewAnchorId(userReview)}`;

                    return (
                      <CourseReview
                        anchorId={mobileAnchorId}
                        highlighted={highlightedReviewId === mobileAnchorId}
                        canModify={Boolean(
                          user && userReview.userId === user.id
                        )}
                        handleDelete={() => handleDelete(userReview)}
                        openEditReview={() => setEditReviewOpen(true)}
                        review={userReview}
                        interactions={interactions}
                        attachment={ReviewAttachment.CopyButton}
                        updateLikes={updateLikes(userReview)}
                      />
                    );
                  })()}
                {showingReviews.length > 0
                  ? showingReviews
                      .filter((review) =>
                        user ? review.userId !== user.id : true
                      )
                      .slice(0, showAllReviews ? showingReviews.length : 8)
                      .map((review) => {
                        const mobileAnchorId = `mobile-${getReviewAnchorId(review)}`;

                        return (
                          <CourseReview
                            anchorId={mobileAnchorId}
                            highlighted={highlightedReviewId === mobileAnchorId}
                            canModify={Boolean(
                              user && review.userId === user.id
                            )}
                            handleDelete={() => handleDelete(review)}
                            key={mobileAnchorId}
                            openEditReview={() => setEditReviewOpen(true)}
                            review={review}
                            interactions={interactions}
                            attachment={ReviewAttachment.CopyButton}
                            updateLikes={updateLikes(review)}
                          />
                        );
                      })
                  : allReviews &&
                    allReviews.length > 0 && (
                      <ReviewEmptyPrompt className='my-8'>
                        No reviews have been left for this course with this
                        instructor yet.
                      </ReviewEmptyPrompt>
                    )}
              </div>
              {!showAllReviews && showingReviews.length > 8 && (
                <div className='flex justify-center text-gray-400 dark:text-neutral-500'>
                  <button
                    className='size-full border border-dashed border-neutral-400 py-2 dark:border-neutral-500'
                    onClick={() => setShowAllReviews(true)}
                  >
                    Show all {showingReviews.length} reviews
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <AddReviewForm
          course={course}
          open={addReviewOpen}
          onClose={() => setAddReviewOpen(false)}
          handleSubmit={handleSubmit('Review added successfully')}
        />
        {userReview && (
          <EditReviewForm
            course={course}
            open={editReviewOpen}
            onClose={() => setEditReviewOpen(false)}
            review={userReview}
            handleSubmit={handleSubmit('Review edited successfully')}
          />
        )}
      </div>
    </Layout>
  );
};
