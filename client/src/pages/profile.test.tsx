import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Review, Subscription } from '../lib/types';
import { Profile } from './profile';

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

vi.mock('../components/delete-button', () => ({
  DeleteButton: () => <button type='button'>delete</button>,
}));

vi.mock('../components/spinner', () => ({
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

const mockTab = vi.hoisted(() =>
  Object.assign(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => (
      <button type='button' onClick={onClick}>
        {typeof children === 'function'
          ? children({ selected: true })
          : children}
      </button>
    ),
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
    getSubscriptions: vi.fn(),
    removeSubscription: vi.fn(),
  },
}));

const getReviewsMock = api.getReviews as Mock;
const getSubscriptionsMock = api.getSubscriptions as Mock;

describe('Profile page', () => {
  beforeEach(() => {
    courseReviewMock.mockClear();
    getReviewsMock.mockReset();
    getSubscriptionsMock.mockReset();
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

    const subscriptions: Subscription[] = [
      {
        courseId: 'COMP202',
        createdAt: '2024-01-01',
      },
    ];

    getReviewsMock.mockResolvedValue({ reviews });
    getSubscriptionsMock.mockResolvedValue(subscriptions);

    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => expect(courseReviewMock).toHaveBeenCalled());

    const attachments = courseReviewMock.mock.calls.map(
      ([props]) => props.attachment
    );

    expect(attachments.length).toBe(1);
    expect(attachments[0]).toBe('scrollButton');
  });
});
