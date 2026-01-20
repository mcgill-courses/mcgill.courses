import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Notification } from '../lib/types';
import { NotificationDropdown } from './notification-dropdown';

const courseReviewMock = vi.hoisted(() =>
  vi.fn((props: any) => (
    <div data-testid='notification-review' data-attachment={props.attachment} />
  ))
);

const IntersectionObserverMock = vi.fn().mockImplementation(
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn();
    root = null;
    rootMargin = '';
    thresholds: number[] = [];
  }
);

beforeAll(() => {
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: IntersectionObserverMock,
  });
});

vi.mock('./course-review', () => ({
  CourseReview: courseReviewMock,
  ReviewAttachment: {
    ScrollButton: 'scrollButton',
    CopyButton: 'copyButton',
  },
}));

vi.mock('@headlessui/react', () => {
  const Menu = ({ children }: { children: any }) => {
    if (typeof children === 'function') {
      return <>{children({ open: true })}</>;
    }
    return <>{children}</>;
  };

  Menu.Button = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );

  Menu.Items = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );

  Menu.Item = ({ children }: { children: () => React.ReactNode }) => (
    <div>{children()}</div>
  );

  return {
    Menu,
    Transition: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({
  api: {
    updateNotification: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

const updateNotificationMock = api.updateNotification as Mock;
const deleteNotificationMock = api.deleteNotification as Mock;

describe('NotificationDropdown', () => {
  beforeEach(() => {
    courseReviewMock.mockClear();
    updateNotificationMock.mockReset();
    deleteNotificationMock.mockReset();
  });

  it('renders notifications with scrollable attachments', async () => {
    const notifications: Notification[] = [
      {
        review: {
          courseId: 'COMP202',
          userId: 'user-1',
          timestamp: '1700000000000',
          content: 'New review',
          difficulty: 3,
          instructors: ['Instructor'],
          likes: 0,
          rating: 4,
        },
        seen: false,
        userId: 'user-1',
      },
    ];

    const setNotifications = vi.fn();

    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <NotificationDropdown
          notifications={notifications}
          setNotifications={setNotifications}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(courseReviewMock).toHaveBeenCalled());

    const [[props]] = courseReviewMock.mock.calls;
    expect(props.attachment).toBe('scrollButton');
  });
});
