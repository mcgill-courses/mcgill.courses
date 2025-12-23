import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api';
import type { Review, User } from '../lib/types';
import type { Course } from '../lib/types';
import { AuthContext } from '../providers/auth-provider';
import { CourseInfo } from './course-info';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./course-info-stats', () => ({
  CourseInfoStats: ({
    reviews,
    className,
  }: {
    reviews: any[];
    className?: string;
  }) => (
    <div data-testid='course-info-stats' className={className}>
      stats-{reviews.length}
    </div>
  ),
}));

vi.mock('./course-terms', () => ({
  CourseTerms: ({ course }: { course: { terms: string[] } }) => (
    <div data-testid='course-terms'>{course.terms.join(', ')}</div>
  ),
}));

vi.mock('../lib/api', () => ({
  api: {
    getSubscription: vi.fn(),
    addSubscription: vi.fn(),
    removeSubscription: vi.fn(),
  },
}));

const baseCourse: Course = {
  _id: 'COMP-202',
  title: 'Software Design',
  credits: '3',
  subject: 'COMP',
  code: '202',
  url: 'https://example.com',
  department: 'Computer Science',
  faculty: 'Science',
  terms: ['Fall'],
  description: 'Introductory course.',
  instructors: [],
  prerequisites: [],
  corequisites: [],
  logicalPrerequisites: undefined,
  logicalCorequisites: undefined,
  leadingTo: [],
  restrictions: '',
  schedule: [],
  avgRating: 0,
  avgDifficulty: 0,
  reviewCount: 0,
};

const defaultReviews: Review[] = [
  {
    content: 'Great course!',
    courseId: baseCourse._id,
    difficulty: 3,
    instructors: [],
    likes: 0,
    rating: 4,
    timestamp: '2024-01-01T00:00:00Z',
    userId: 'reviewer',
  },
];

const defaultUser: User = {
  id: 'user-1',
  mail: 'user@example.com',
};

const getSubscriptionMock = api.getSubscription as Mock;
const addSubscriptionMock = api.addSubscription as Mock;
const removeSubscriptionMock = api.removeSubscription as Mock;

type RenderOptions = {
  user?: User | undefined;
  reviews?: Review[];
  course?: Course;
};

const renderCourseInfo = (options: RenderOptions = {}) => {
  const { reviews = defaultReviews, course = baseCourse } = options;
  const user = Object.prototype.hasOwnProperty.call(options, 'user')
    ? options.user
    : defaultUser;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );

  return {
    queryClient,
    ...render(<CourseInfo course={course} reviews={reviews} />, { wrapper }),
  };
};

describe('CourseInfo', () => {
  beforeEach(() => {
    getSubscriptionMock.mockReset();
    addSubscriptionMock.mockReset();
    removeSubscriptionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders subscribe icon when the user is not subscribed', async () => {
    getSubscriptionMock.mockResolvedValue(null);

    renderCourseInfo();

    await waitFor(() =>
      expect(getSubscriptionMock).toHaveBeenCalledWith(baseCourse._id)
    );

    expect(await screen.findByTestId('subscribe-icon')).toBeInTheDocument();
    expect(screen.getByText('1 review')).toBeInTheDocument();
  });

  it('renders unsubscribe icon when the user is subscribed', async () => {
    getSubscriptionMock.mockResolvedValue({
      courseId: baseCourse._id,
      userId: defaultUser.id,
    });

    renderCourseInfo();

    await waitFor(() => expect(getSubscriptionMock).toHaveBeenCalled());

    expect(await screen.findByTestId('unsubscribe-icon')).toBeInTheDocument();
  });

  it('subscribes the user when clicking the bell icon', async () => {
    getSubscriptionMock.mockResolvedValue(null);
    addSubscriptionMock.mockResolvedValue({});

    renderCourseInfo();

    const subscribeIcon = await screen.findByTestId('subscribe-icon');
    await userEvent.click(subscribeIcon);

    await waitFor(() =>
      expect(addSubscriptionMock).toHaveBeenCalledWith(baseCourse._id)
    );
    await waitFor(() =>
      expect(screen.queryByTestId('unsubscribe-icon')).not.toBeNull()
    );
  });

  it('unsubscribes the user when clicking the bell-off icon', async () => {
    getSubscriptionMock.mockResolvedValue({
      courseId: baseCourse._id,
      userId: defaultUser.id,
    });
    removeSubscriptionMock.mockResolvedValue({});

    renderCourseInfo();

    const unsubscribeIcon = await screen.findByTestId('unsubscribe-icon');
    await userEvent.click(unsubscribeIcon);

    await waitFor(() =>
      expect(removeSubscriptionMock).toHaveBeenCalledWith(baseCourse._id)
    );
    await waitFor(() =>
      expect(screen.queryByTestId('subscribe-icon')).not.toBeNull()
    );
  });

  it('does not fetch subscription when no user is authenticated', async () => {
    renderCourseInfo({ user: undefined });

    await waitFor(() => expect(getSubscriptionMock).not.toHaveBeenCalled());
  });

  it('pluralizes review count', async () => {
    getSubscriptionMock.mockResolvedValue(null);

    renderCourseInfo({
      reviews: [
        ...defaultReviews,
        {
          ...defaultReviews[0],
          userId: 'reviewer-2',
          timestamp: '2024-01-02T00:00:00Z',
        },
      ],
    });

    await waitFor(() => expect(getSubscriptionMock).toHaveBeenCalled());
    expect(screen.getByText('2 reviews')).toBeInTheDocument();
  });
});
