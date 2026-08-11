import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../lib/env';
import { ProfileDropdown } from './profile-dropdown';

vi.mock('@headlessui/react', () => {
  const Menu = ({ children }: { children: any }) => {
    if (typeof children === 'function') {
      return <>{children({ open: true })}</>;
    }

    return <>{children}</>;
  };

  Menu.Button = ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <button type='button' {...props}>
      {children}
    </button>
  );

  Menu.Items = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  Menu.Item = ({
    children,
  }: {
    children: (context: { active: boolean }) => ReactNode;
  }) => <>{children({ active: false })}</>;

  return {
    Menu,
    Transition: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

describe('ProfileDropdown', () => {
  const originalApiUrl = env.VITE_API_URL;

  afterEach(() => {
    Object.assign(env, { VITE_API_URL: originalApiUrl });
  });

  const renderDropdown = () =>
    render(
      <MemoryRouter>
        <ProfileDropdown />
      </MemoryRouter>
    );

  it('renders profile link', () => {
    Object.assign(env, { VITE_API_URL: 'https://api.example.com' });

    renderDropdown();

    const profileLink = screen.getByRole('link', { name: /profile/i });

    expect(profileLink.getAttribute('href')).toBe('/profile');
  });

  it('redirects to logout endpoint', async () => {
    Object.assign(env, { VITE_API_URL: 'https://api.example.com' });

    const originalLocation = window.location;
    const setHref = vi.fn();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://mcgill.courses',
        get href() {
          return '';
        },
        set href(value: string) {
          setHref(value);
        },
      },
    });

    const user = userEvent.setup();

    renderDropdown();

    const logoutButton = screen.getByRole('button', { name: /log out/i });
    await user.click(logoutButton);

    expect(setHref).toHaveBeenCalledWith(
      'https://api.example.com/api/auth/logout?redirect=https://mcgill.courses'
    );

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
