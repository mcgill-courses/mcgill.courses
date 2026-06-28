import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Review, Subscription } from '../lib/types';
import { Profile } from './profile';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderProfile = () => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Profile />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const courseReviewMock = vi.hoisted(() =>
  vi.fn((props: any) => (
    <div data-testid='profile-review' data-attachment={props.attachment} />
  ))
);

vi.mock('../components/course-review', () => ({
  CourseReview: courseReviewMock,
  ReviewAttachment: {
    ScrollButton: 'scrollButton',
    CopyButton: 'copyButton',
  },
}));

vi.mock('../components/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/jump-to-top-button', () => ({
  JumpToTopButton: () => <div data-testid='jump-top' />,
}));

vi.mock('../components/ui/delete-button', () => ({
  DeleteButton: () => <button type='button'>delete</button>,
}));

vi.mock('../components/ui/spinner', () => ({
  Spinner: () => <div data-testid='spinner' />,
}));

vi.mock('./loading', () => ({
  Loading: () => <div data-testid='loading' />,
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  HelmetProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('../hooks/use-auth', () => ({
  useAuth: () => ({ id: 'user-1', email: 'user@example.com' }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const toastErrorMock = toast.error as Mock;
const toastSuccessMock = toast.success as Mock;

const mockTab = vi.hoisted(() =>
  Object.assign(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => {
      const childContent =
        typeof children === 'function'
          ? (children as (args: { selected: boolean }) => React.ReactNode)({
              selected: true,
            })
          : children;

      return (
        <button type='button' onClick={onClick}>
          {childContent}
        </button>
      );
    },
    {
      Group: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      List: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Panels: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Panel: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
    }
  )
);

vi.mock('@headlessui/react', () => ({
  Tab: mockTab,
}));

vi.mock('../lib/api', () => ({
  api: {
    getReviews: vi.fn(),
    getLikedReviews: vi.fn(),
    getSubscriptions: vi.fn(),
    removeSubscription: vi.fn(),
  },
}));

const getReviewsMock = api.getReviews as Mock;
const getLikedReviewsMock = api.getLikedReviews as Mock;
const getSubscriptionsMock = api.getSubscriptions as Mock;
const removeSubscriptionMock = api.removeSubscription as Mock;

describe('Profile page', () => {
  beforeEach(() => {
    courseReviewMock.mockClear();
    getReviewsMock.mockReset();
    getLikedReviewsMock.mockReset();
    getSubscriptionsMock.mockReset();
    removeSubscriptionMock.mockReset();
    toastErrorMock.mockClear();
    toastSuccessMock.mockClear();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  it('renders user reviews with scroll attachments', async () => {
    const reviews: Review[] = [
      {
        content: 'User review',
        courseId: 'COMP202',
        difficulty: 2,
        instructors: ['Instructor'],
        likes: 0,
        rating: 5,
        timestamp: '1700000000000',
        userId: 'user-1',
      },
    ];

    const likedReviews: Review[] = [
      {
        content: 'Liked review',
        courseId: 'COMP303',
        difficulty: 4,
        instructors: ['Instructor'],
        likes: 2,
        rating: 4,
        timestamp: '1700000001000',
        userId: 'user-2',
      },
    ];

    const subscriptions: Subscription[] = [
      {
        courseId: 'COMP202',
        userId: 'user-1',
      },
    ];

    getReviewsMock.mockResolvedValue({ reviews });
    getLikedReviewsMock.mockResolvedValue({ reviews: likedReviews });
    getSubscriptionsMock.mockResolvedValue(subscriptions);

    renderProfile();

    await waitFor(() => expect(courseReviewMock).toHaveBeenCalled());

    const attachments = courseReviewMock.mock.calls.map(
      ([props]) => props.attachment
    );

    expect(attachments.length).toBe(2);
    expect(attachments).toEqual(['scrollButton', 'scrollButton']);
  });

  it('shows loading state while data is being fetched', async () => {
    getReviewsMock.mockReturnValue(new Promise(() => {}));
    getLikedReviewsMock.mockReturnValue(new Promise(() => {}));
    getSubscriptionsMock.mockReturnValue(new Promise(() => {}));

    renderProfile();

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows error toast when fetching reviews fails', async () => {
    getReviewsMock.mockRejectedValue(new Error('Failed to fetch'));
    getLikedReviewsMock.mockResolvedValue({ reviews: [] });
    getSubscriptionsMock.mockResolvedValue([]);

    renderProfile();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'An error occurred while fetching your reviews, please try again later'
      );
    });
  });

  it('shows error toast when fetching liked reviews fails', async () => {
    getReviewsMock.mockResolvedValue({ reviews: [] });
    getLikedReviewsMock.mockRejectedValue(new Error('Failed to fetch'));
    getSubscriptionsMock.mockResolvedValue([]);

    renderProfile();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'An error occurred while fetching your liked reviews, please try again later'
      );
    });
  });

  it('shows error toast when fetching subscriptions fails', async () => {
    getReviewsMock.mockResolvedValue({ reviews: [] });
    getLikedReviewsMock.mockResolvedValue({ reviews: [] });
    getSubscriptionsMock.mockRejectedValue(new Error('Failed to fetch'));

    renderProfile();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'An error occurred while fetching your subscriptions, please try again later'
      );
    });
  });

  it('renders empty state when user has no reviews', async () => {
    getReviewsMock.mockResolvedValue({ reviews: [] });
    getLikedReviewsMock.mockResolvedValue({ reviews: [] });
    getSubscriptionsMock.mockResolvedValue([]);

    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByText(/No reviews found, if you've taken a course/)
      ).toBeInTheDocument();
    });
  });

  it('renders empty state when user has no liked reviews', async () => {
    getReviewsMock.mockResolvedValue({ reviews: [] });
    getLikedReviewsMock.mockResolvedValue({ reviews: [] });
    getSubscriptionsMock.mockResolvedValue([]);

    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByText(/No liked reviews yet, tap the thumbs-up/)
      ).toBeInTheDocument();
    });
  });

  it('renders empty state when user has no subscriptions', async () => {
    getReviewsMock.mockResolvedValue({ reviews: [] });
    getLikedReviewsMock.mockResolvedValue({ reviews: [] });
    getSubscriptionsMock.mockResolvedValue([]);

    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByText(/No subscriptions found, click the bell icon/)
      ).toBeInTheDocument();
    });
  });

  it('displays singular label for 1 review', async () => {
    const reviews: Review[] = [
      {
        content: 'Single review',
        courseId: 'COMP202',
        difficulty: 2,
        instructors: ['Instructor'],
        likes: 0,
        rating: 5,
        timestamp: '1700000000000',
        userId: 'user-1',
      },
    ];

    getReviewsMock.mockResolvedValue({ reviews });
    getLikedReviewsMock.mockResolvedValue({ reviews: [] });
    getSubscriptionsMock.mockResolvedValue([]);

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText('1 review')).toBeInTheDocument();
    });
  });

  it('displays singular label for 1 liked review', async () => {
    const likedReviews: Review[] = [
      {
        content: 'Single liked review',
        courseId: 'COMP303',
        difficulty: 4,
        instructors: ['Instructor'],
        likes: 2,
        rating: 4,
        timestamp: '1700000001000',
        userId: 'user-2',
      },
    ];

    getReviewsMock.mockResolvedValue({ reviews: [] });
    getLikedReviewsMock.mockResolvedValue({ reviews: likedReviews });
    getSubscriptionsMock.mockResolvedValue([]);

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText('1 liked review')).toBeInTheDocument();
    });
  });

  it('restores selected tab index from localStorage', async () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => '2'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    getReviewsMock.mockResolvedValue({ reviews: [] });
    getLikedReviewsMock.mockResolvedValue({ reviews: [] });
    getSubscriptionsMock.mockResolvedValue([]);

    renderProfile();

    await waitFor(() => {
      expect(localStorage.getItem).toHaveBeenCalledWith('selectedTabIndex');
    });
  });
});
