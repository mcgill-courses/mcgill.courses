import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Review } from '../lib/types';
import { getReviewAnchorId } from '../lib/utils';
import type { Course } from '../model/course';
import { CoursePage } from './course-page';

vi.mock('../lib/api', () => ({
  api: {
    getCourseWithReviews: vi.fn(),
    getUserInteractionsForCourse: vi.fn(),
    deleteReview: vi.fn(),
  },
}));

vi.mock('../hooks/use-auth', () => ({
  useAuth: () => null,
}));

vi.mock('../components/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/course-info', () => ({
  CourseInfo: () => <div data-testid='course-info' />,
}));

vi.mock('../components/course-averages', () => ({
  CourseAverages: () => <div data-testid='course-averages' />,
}));

vi.mock('../components/course-requirements', () => ({
  CourseRequirements: () => <div data-testid='course-requirements' />,
}));

vi.mock('../components/review-filter', () => ({
  ReviewFilter: () => <div data-testid='review-filter' />,
}));

vi.mock('../components/course-review-prompt', () => ({
  CourseReviewPrompt: () => <div data-testid='course-review-prompt' />,
}));

vi.mock('../components/add-review-form', () => ({
  AddReviewForm: () => <div data-testid='add-review-form' />,
}));

vi.mock('../components/edit-review-form', () => ({
  EditReviewForm: () => <div data-testid='edit-review-form' />,
}));

vi.mock('../components/review-empty-prompt', () => ({
  ReviewEmptyPrompt: () => <div data-testid='review-empty' />,
}));

vi.mock('../components/schedules-display', () => ({
  SchedulesDisplay: () => <div data-testid='schedules-display' />,
}));

vi.mock('../components/course-review', () => ({
  CourseReview: ({
    anchorId,
    review,
  }: {
    anchorId?: string;
    review: Review;
  }) => (
    <div data-testid={`course-review-${review.userId}`} id={anchorId}>
      {review.content}
    </div>
  ),
  ReviewAttachment: {
    ScrollButton: 'scrollButton',
    CopyButton: 'copyButton',
  },
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  HelmetProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const getCourseWithReviewsMock = api.getCourseWithReviews as Mock;
const getUserInteractionsForCourseMock =
  api.getUserInteractionsForCourse as Mock;

const scrollIntoViewMock = vi.fn();
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

describe('CoursePage', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  beforeEach(() => {
    scrollIntoViewMock.mockClear();
    getCourseWithReviewsMock.mockReset();
    getUserInteractionsForCourseMock.mockReset();

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    );

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now());
      return 0;
    });
  });

  afterAll(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expands review list and scrolls to targeted review from location state', async () => {
    const course: Course = {
      _id: 'COMP202',
      title: 'Foundations of Programming',
      description: 'Intro course',
      subject: 'COMP',
      code: '202',
      credits: '3',
      url: '',
      department: 'Computer Science',
      faculty: 'Science',
      terms: ['Fall 2023'],
      instructors: [],
      prerequisites: [],
      corequisites: [],
      leadingTo: [],
      restrictions: '',
      schedule: [],
    };

    const reviews: Review[] = Array.from({ length: 9 }, (_, index) => ({
      content: `Review ${index}`,
      courseId: 'COMP202',
      difficulty: 3,
      instructors: ['Instructor'],
      likes: 0,
      rating: 4,
      timestamp: String(1700000000000 + index),
      userId: `user-${index}`,
    }));

    const targetReview = reviews[8];

    getCourseWithReviewsMock.mockResolvedValue({
      course,
      reviews,
    });

    const initialEntries = [
      {
        pathname: '/course/comp-202',
        state: { scrollToReview: getReviewAnchorId(targetReview) },
      },
    ];

    render(
      <MemoryRouter
        initialEntries={initialEntries}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path='/course/:id' element={<CoursePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(api.getCourseWithReviews).toHaveBeenCalled());

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /show all/i })
      ).not.toBeInTheDocument()
    );

    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled());
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });
});
