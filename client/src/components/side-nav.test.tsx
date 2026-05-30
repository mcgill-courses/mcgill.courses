import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { useAuth } from '../hooks/use-auth';
import { useDarkMode } from '../hooks/use-dark-mode';
import { env } from '../lib/env';
import { routerFutureConfig } from '../testing/router-wrapper';
import { SideNav } from './side-nav';

vi.mock('@headlessui/react', () => {
  const Transition = ({ children }: { children: ReactNode }) => <>{children}</>;

  Transition.Child = ({ children }: { children: ReactNode }) => <>{children}</>;

  return { Transition };
});

vi.mock('../hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/use-dark-mode', () => ({
  useDarkMode: vi.fn(),
}));

vi.mock('./dark-mode-toggle', () => ({
  DarkModeToggle: () => <div data-testid='dark-mode-toggle' />,
}));

vi.mock('./logo', () => ({
  Logo: ({ size }: { size: number }) => (
    <div data-testid='logo' data-size={size} />
  ),
}));

describe('SideNav', () => {
  const originalLocation = window.location;
  const originalApiUrl = env.VITE_API_URL;
  const useAuthMock = useAuth as unknown as Mock;
  const useDarkModeMock = useDarkMode as unknown as Mock;

  beforeEach(() => {
    const overlayRoot = document.createElement('div');
    overlayRoot.setAttribute('id', 'overlay-root');
    document.body.appendChild(overlayRoot);
  });

  afterEach(() => {
    document.getElementById('overlay-root')?.remove();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });

    Object.assign(env, { VITE_API_URL: originalApiUrl });

    useAuthMock.mockReset();
    useDarkModeMock.mockReset();

    document.body.style.overflow = '';
  });

  const renderSideNav = (onClose: (open: boolean) => void) =>
    render(
      <MemoryRouter future={routerFutureConfig}>
        <SideNav open onClose={onClose} />
      </MemoryRouter>
    );

  it('shows logout option for authenticated users and closes on navigation item', async () => {
    Object.assign(env, { VITE_API_URL: 'https://api.example.com' });

    useAuthMock.mockReturnValue({ id: 'user-1' });
    useDarkModeMock.mockReturnValue([false, vi.fn()]);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://mcgill.courses',
      },
    });

    const onClose = vi.fn();
    const user = userEvent.setup();

    renderSideNav(onClose);

    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();

    const logoutLink = screen.getByRole('link', { name: /log out/i });

    expect(logoutLink).toHaveAttribute(
      'href',
      'https://api.example.com/api/auth/logout?redirect=https://mcgill.courses'
    );

    await user.click(screen.getByRole('link', { name: /home/i }));

    expect(onClose).toHaveBeenCalledWith(false);

    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
  });

  it('shows login option for anonymous users and closes with toggle button', async () => {
    Object.assign(env, { VITE_API_URL: 'https://api.example.com' });
    useAuthMock.mockReturnValue(undefined);
    useDarkModeMock.mockReturnValue([true, vi.fn()]);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://mcgill.courses',
        href: 'https://mcgill.courses/explore',
      },
    });

    const onClose = vi.fn();
    const user = userEvent.setup();

    renderSideNav(onClose);

    const loginLink = screen.getByRole('link', { name: /log in/i });

    expect(loginLink).toHaveAttribute(
      'href',
      'https://api.example.com/api/auth/login?redirect=https://mcgill.courses/explore'
    );

    const closeButton = screen.getByRole('button', { name: /close menu/i });

    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledWith(false);
  });
});
