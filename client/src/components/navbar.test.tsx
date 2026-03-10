import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../lib/env';
import { routerFutureConfig } from '../testing/router-wrapper';
import { Navbar } from './navbar';

const getNotificationsMock = vi.hoisted(() => vi.fn());
const useAuthMock = vi.hoisted(() => vi.fn());
const notificationRenderMock = vi.hoisted(() => vi.fn());
const sideNavRenderMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
  api: {
    getNotifications: getNotificationsMock,
  },
}));

vi.mock('../hooks/use-auth', () => ({
  useAuth: useAuthMock,
}));

vi.mock('../lib/search-index', () => ({
  getSearchIndex: () => ({
    courses: [],
    instructors: [],
    coursesIndex: { search: () => [] },
    instructorsIndex: { search: () => [] },
  }),
  updateSearchResults: vi.fn(),
}));

vi.mock('./course-search-bar', () => ({
  CourseSearchBar: ({
    results: _results,
    handleInputChange,
    onResultClick,
  }: {
    results: any;
    handleInputChange: (query: string) => void;
    onResultClick?: () => void;
  }) => (
    <div
      data-testid='course-search'
      data-handleinputchange={!!handleInputChange}
      data-onresultclick={!!onResultClick}
    />
  ),
}));

vi.mock('./dark-mode-toggle', () => ({
  DarkModeToggle: () => <div data-testid='dark-mode-toggle' />,
}));

vi.mock('./logo', () => ({
  Logo: ({ className }: { className?: string }) => (
    <div data-testid='logo' data-class={className} />
  ),
}));

vi.mock('./notification-dropdown', () => ({
  NotificationDropdown: (props: {
    notifications: any[];
    setNotifications: (notifications: any[]) => void;
  }) => {
    notificationRenderMock(props);
    return (
      <button
        data-testid='notification-dropdown'
        data-count={props.notifications.length}
        onClick={() => props.setNotifications(props.notifications)}
      />
    );
  },
}));

vi.mock('./profile-dropdown', () => ({
  ProfileDropdown: () => <div data-testid='profile-dropdown' />,
}));

vi.mock('./side-nav', () => ({
  SideNav: (props: { open: boolean; onClose: (open: boolean) => void }) => {
    sideNavRenderMock(props);
    return (
      <button
        data-testid='side-nav'
        data-open={props.open}
        onClick={() => props.onClose(false)}
      />
    );
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('Navbar', () => {
  const originalLocation = window.location;
  const originalApiUrl = env.VITE_API_URL;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    Object.assign(env, { VITE_API_URL: originalApiUrl });
    useAuthMock.mockReset();
    getNotificationsMock.mockReset();
    notificationRenderMock.mockReset();
    sideNavRenderMock.mockReset();
  });

  const renderNavbar = (initialPath: string) =>
    render(
      <MemoryRouter initialEntries={[initialPath]} future={routerFutureConfig}>
        <Navbar />
      </MemoryRouter>
    );

  it('renders login link with arrow toggle for guests', async () => {
    Object.assign(env, { VITE_API_URL: 'https://api.example.com' });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'https://mcgill.courses/',
        origin: 'https://mcgill.courses',
      },
    });

    useAuthMock.mockReturnValue(undefined);

    const user = userEvent.setup();

    renderNavbar('/');

    expect(screen.queryByTestId('course-search')).not.toBeInTheDocument();

    const loginLink = screen.getByRole('link', { name: /log in/i });
    expect(loginLink).toHaveAttribute(
      'href',
      'https://api.example.com/api/auth/login?redirect=https://mcgill.courses/'
    );

    const arrow = within(loginLink).getByText('→');
    expect(arrow).toHaveClass('text-gray-900 dark:text-gray-200');

    await user.hover(loginLink);
    expect(arrow).toHaveClass('text-red-600');

    await user.unhover(loginLink);
    expect(arrow).toHaveClass('text-gray-900 dark:text-gray-200');

    expect(getNotificationsMock).not.toHaveBeenCalled();
  });

  it('loads notifications and shows authenticated controls', async () => {
    Object.assign(env, { VITE_API_URL: 'https://api.example.com' });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'https://mcgill.courses/explore',
        origin: 'https://mcgill.courses',
      },
    });

    useAuthMock.mockReturnValue({ id: 'user-1' });

    getNotificationsMock.mockResolvedValue([
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
    ]);

    const user = userEvent.setup();

    renderNavbar('/explore');

    await waitFor(() => expect(getNotificationsMock).toHaveBeenCalled());

    expect(screen.getByTestId('course-search')).toBeInTheDocument();

    await waitFor(() => {
      const dropdowns = screen.getAllByTestId('notification-dropdown');
      expect(dropdowns).toHaveLength(2);
      dropdowns.forEach((dropdown) =>
        expect(dropdown).toHaveAttribute('data-count', '1')
      );
    });

    expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument();

    expect(sideNavRenderMock.mock.calls.at(-1)?.[0]?.open).toBe(false);

    await user.click(screen.getByRole('button', { name: /open main menu/i }));

    expect(sideNavRenderMock.mock.calls.at(-1)?.[0]?.open).toBe(true);
  });
});
