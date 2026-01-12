import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Review } from '../lib/types';
import { Instructor } from './instructor';

const courseReviewMock = vi.hoisted(() =>
  vi.fn((props: any) => (
    <div
      data-testid={`instructor-review-${props.review.userId}`}
      data-attachment={props.attachment}
    >
      {props.review.content}
    </div>
  ))
);

vi.mock('../components/course-review', () => ({
  CourseReview: courseReviewMock,
  ReviewAttachment: {
    ScrollButton: 'scrollButton',
    CopyButton: 'copyButton',
  },
}));

vi.mock('../components/review-empty-prompt', () => ({
  ReviewEmptyPrompt: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='empty'>{children}</div>
  ),
}));

vi.mock('../components/course-info-stats', () => ({
  CourseInfoStats: () => <div data-testid='course-info-stats' />,
}));

vi.mock('../components/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  HelmetProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('./loading', () => ({
  Loading: () => <div data-testid='loading' />,
}));

vi.mock('./not-found', () => ({
  NotFound: () => <div data-testid='not-found' />,
}));

vi.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ id: 'user-0' }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({
  api: {
    getInstructor: vi.fn(),
  },
}));

const getInstructorMock = api.getInstructor as Mock;

describe('Instructor page', () => {
  beforeEach(() => {
    courseReviewMock.mockClear();
  });

  it('renders instructor reviews with scroll attachments', async () => {
    const reviews: Review[] = [
      {
        content: 'My own review',
        courseId: 'COMP202',
        difficulty: 3,
        instructors: ['Instructor'],
        likes: 0,
        rating: 4,
        timestamp: '1700000000000',
        userId: 'user-0',
      },
      {
        content: 'Another review',
        courseId: 'COMP202',
        difficulty: 2,
        instructors: ['Instructor'],
        likes: 1,
        rating: 5,
        timestamp: '1700000000001',
        userId: 'user-1',
      },
    ];

    getInstructorMock.mockResolvedValue({
      instructor: { name: 'Instructor Name' },
      reviews,
      courses: [],
    });

    render(
      <MemoryRouter
        initialEntries={['/instructor/Instructor%20Name']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path='/instructor/:name' element={<Instructor />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(courseReviewMock).toHaveBeenCalled());

    const attachments = courseReviewMock.mock.calls.map(
      ([props]) => props.attachment
    );

    expect(attachments.length).toBe(2);
    expect(new Set(attachments)).toEqual(new Set(['scrollButton']));
  });
});
