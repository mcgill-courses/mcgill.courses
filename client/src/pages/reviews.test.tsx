import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Review } from '../lib/types';
import { Reviews } from './reviews';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderReviews = () => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Reviews />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const { timeSinceMock, mockIntersectionObserver } = vi.hoisted(() => {
  const observerCallback = {
    current: null as IntersectionObserverCallback | null,
  };

  return {
    timeSinceMock: vi.fn(
      (value: number | string) => `relative-${value.toString()}`
    ),
    mockIntersectionObserver: {
      callback: observerCallback,
      trigger: (isIntersecting: boolean) => {
        if (observerCallback.current) {
          observerCallback.current(
            [{ isIntersecting } as IntersectionObserverEntry],
            {} as IntersectionObserver
          );
        }
      },
    },
  };
});

vi.mock('../lib/utils', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/utils')>('../lib/utils');

  return {
    ...actual,
    timeSince: timeSinceMock,
  };
});

vi.mock('../lib/api', () => ({
  api: {
    getReviews: vi.fn(),
  },
}));

vi.mock('../components/layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => (
    <div data-testid='layout'>{children}</div>
  ),
}));

vi.mock('../components/jump-to-top-button', () => ({
  JumpToTopButton: () => <div data-testid='jump-to-top' />,
}));

vi.mock('../components/course-review', () => ({
  CourseReview: ({ review }: { review: Review }) => (
    <div data-testid={`course-review-${review.userId}`}>{review.content}</div>
  ),
  ReviewAttachment: {
    ScrollButton: 'scrollButton',
    CopyButton: 'copyButton',
  },
}));

vi.mock('../components/spinner', () => ({
  Spinner: () => <div data-testid='spinner' />,
}));

vi.mock('./loading', () => ({
  Loading: () => <div data-testid='loading-indicator' />,
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

beforeAll(() => {
  globalThis.IntersectionObserver = class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      mockIntersectionObserver.callback.current = callback;
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    root = null;
    rootMargin = '';
    thresholds = [];
    takeRecords = vi.fn(() => []);
  } as unknown as typeof IntersectionObserver;
});

const getReviewsMock = api.getReviews as Mock;

const buildReview = (overrides: Partial<Review> = {}): Review => ({
  content: 'A thoughtful take',
  courseId: 'COMP202',
  difficulty: 3,
  instructors: ['Ada Lovelace'],
  likes: 0,
  rating: 4,
  timestamp: '1700000000000',
  userId: 'user-1',
  ...overrides,
});

describe('Reviews page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading indicator while the initial request is in flight', async () => {
    getReviewsMock.mockReturnValue(new Promise(() => {}));

    renderReviews();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await waitFor(() =>
      expect(getReviewsMock).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sorted: true,
        withUserCount: true,
      })
    );
  });

  it('renders loaded reviews and user count after a successful fetch', async () => {
    const uniqueUserCount = 1234;

    const review = buildReview();

    getReviewsMock.mockResolvedValueOnce({
      reviews: [review],
      uniqueUserCount,
    });

    renderReviews();

    const expectedDetail = `Check out what ${uniqueUserCount.toLocaleString(
      'en-us'
    )} verified McGill students on our platform have said about courses at McGill University.`;

    await waitFor(() =>
      expect(screen.getByText(expectedDetail)).toBeInTheDocument()
    );

    expect(screen.getByRole('link', { name: 'COMP 202' })).toHaveAttribute(
      'href',
      '/course/comp-202'
    );

    expect(
      screen.getByTestId(`course-review-${review.userId}`)
    ).toHaveTextContent(review.content);

    expect(
      screen.getByText(`relative-${Number(review.timestamp)}`)
    ).toBeInTheDocument();
  });

  it('fetches and appends additional reviews when scrolled to bottom', async () => {
    const initialReviews = Array.from({ length: 20 }, (_, i) =>
      buildReview({
        content: `Review ${i}`,
        timestamp: `170000000000${i}`,
        userId: `user-${i}`,
      })
    );

    const additionalReview = buildReview({
      content: 'Another perspective',
      timestamp: '1700000000100',
      userId: 'user-extra',
    });

    getReviewsMock
      .mockResolvedValueOnce({
        reviews: initialReviews,
        uniqueUserCount: 21,
      })
      .mockResolvedValueOnce({
        reviews: [additionalReview],
      });

    renderReviews();

    await waitFor(() =>
      expect(
        screen.getByTestId(`course-review-${initialReviews[0].userId}`)
      ).toBeInTheDocument()
    );

    mockIntersectionObserver.trigger(true);

    await waitFor(() => expect(getReviewsMock).toHaveBeenCalledTimes(2));

    expect(getReviewsMock).toHaveBeenLastCalledWith({
      limit: 20,
      offset: 20,
      sorted: true,
      withUserCount: false,
    });

    await waitFor(() =>
      expect(
        screen.getByTestId(`course-review-${additionalReview.userId}`)
      ).toHaveTextContent(additionalReview.content)
    );
  });
});
