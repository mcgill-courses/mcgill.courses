import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Course, Review } from '../lib/types';
import { getCurrentTerm, getCurrentTerms } from '../lib/utils';
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

const createCourse = (_id: string, title: string, term: string): Course => ({
  _id,
  title,
  description: 'foo',
  subject: _id.slice(0, 4),
  code: _id.slice(4),
  credits: '3',
  url: '',
  department: 'foo',
  faculty: 'foo',
  terms: [term],
  instructors: [{ name: 'Instructor Name', term }],
  prerequisites: [],
  corequisites: [],
  leadingTo: [],
  restrictions: '',
  schedule: [],
  avgRating: 0,
  avgDifficulty: 0,
  reviewCount: 0,
});

describe('Instructor page', () => {
  beforeEach(() => {
    courseReviewMock.mockClear();
    getInstructorMock.mockReset();
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
      <MemoryRouter initialEntries={['/instructor/Instructor%20Name']}>
        <Routes>
          <Route path='/instructor/:name' element={<Instructor />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(courseReviewMock).toHaveBeenCalled());
    expect(screen.getByText('2 reviews')).toBeInTheDocument();

    const attachments = courseReviewMock.mock.calls
      .slice(-2)
      .map(([props]) => props.attachment);

    expect(attachments.length).toBe(2);
    expect(new Set(attachments)).toEqual(new Set(['scrollButton']));
  });

  it('switches course term tabs', async () => {
    const currentTerm = getCurrentTerm();
    const otherTerm = getCurrentTerms().find((term) => term !== currentTerm)!;

    const currentCourse = createCourse('COMP202', 'foo', currentTerm);
    const otherCourse = createCourse('COMP303', 'bar', otherTerm);

    getInstructorMock.mockResolvedValue({
      instructor: { name: 'Instructor Name' },
      reviews: [],
      courses: [currentCourse, otherCourse],
    });

    render(
      <MemoryRouter initialEntries={['/instructor/Instructor%20Name']}>
        <Routes>
          <Route path='/instructor/:name' element={<Instructor />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('foo')).toBeInTheDocument();
    expect(screen.queryByText('bar')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: `${otherTerm} 1` }));

    await waitFor(() => expect(screen.getByText('bar')).toBeInTheDocument());

    await waitFor(() =>
      expect(screen.queryByText('foo')).not.toBeInTheDocument()
    );
  });
});
