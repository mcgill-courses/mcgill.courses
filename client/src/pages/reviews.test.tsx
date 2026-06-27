import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Review } from '../lib/types';
import { renderWithRouter } from '../testing/router-wrapper';
import { Reviews } from './reviews';

const { timeSinceMock, toastErrorMock } = vi.hoisted(() => ({
  timeSinceMock: vi.fn(
    (value: number | string) => `relative-${value.toString()}`
  ),
  toastErrorMock: vi.fn(),
}));

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

vi.mock('../components/ui/spinner', () => ({
  Spinner: () => <div data-testid='spinner' />,
}));

vi.mock('./loading', () => ({
  Loading: () => <div data-testid='loading-indicator' />,
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock('react-infinite-scroll-component', () => ({
  __esModule: true,
  default: ({
    children,
    dataLength,
    hasMore,
    loader,
    next,
  }: {
    children: ReactNode;
    dataLength: number;
    hasMore: boolean;
    loader?: ReactNode;
    next: () => void | Promise<void>;
  }) => (
    <div data-testid='infinite-scroll'>
      <div>{children}</div>
      {dataLength >= 20 && hasMore ? loader : null}
      {hasMore ? (
        <button type='button' onClick={next}>
          Load more
        </button>
      ) : null}
    </div>
  ),
}));

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

    renderWithRouter(<Reviews />);

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

    renderWithRouter(<Reviews />);

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

  it('fetches and appends additional reviews when more content is requested', async () => {
    const initialReview = buildReview();

    const additionalReview = buildReview({
      content: 'Another perspective',
      timestamp: '1700000000100',
      userId: 'user-2',
    });

    getReviewsMock
      .mockResolvedValueOnce({
        reviews: [initialReview],
        uniqueUserCount: 1,
      })
      .mockResolvedValueOnce({
        reviews: [additionalReview],
      });

    renderWithRouter(<Reviews />);

    await waitFor(() =>
      expect(
        screen.getByTestId(`course-review-${initialReview.userId}`)
      ).toBeInTheDocument()
    );

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => expect(getReviewsMock).toHaveBeenCalledTimes(2));

    expect(getReviewsMock).toHaveBeenLastCalledWith({
      limit: 20,
      offset: 20,
      sorted: true,
    });

    expect(
      screen.getByTestId(`course-review-${additionalReview.userId}`)
    ).toHaveTextContent(additionalReview.content);

    expect(
      screen.getByText(`relative-${Number(additionalReview.timestamp)}`)
    ).toBeInTheDocument();
  });

  it('surfaces a toast when the initial fetch fails', async () => {
    getReviewsMock.mockRejectedValueOnce(new Error('network error'));

    renderWithRouter(<Reviews />);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Failed to fetch reviews, please try again later'
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });
});
