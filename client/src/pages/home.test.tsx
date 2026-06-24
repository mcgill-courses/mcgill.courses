import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routerFutureConfig } from '../testing/router-wrapper';
import { Home } from './home';

vi.mock('../components/course-search-bar', () => ({
  CourseSearchBar: () => <div data-testid='course-search-bar' />,
}));

vi.mock('../components/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const storageKey = 'mcgill.courses.schedule-builder-banner-seen';

const createStorage = (): Storage => {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear: () => {
      store = {};
    },
    getItem: (key) => store[key] ?? null,
    key: (index) => Object.keys(store)[index] ?? null,
    removeItem: (key) => {
      delete store[key];
    },
    setItem: (key, value) => {
      store[key] = value;
    },
  };
};

const setStorage = (storage: Storage) => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
};

const renderHome = () =>
  render(
    <MemoryRouter future={routerFutureConfig}>
      <Home />
    </MemoryRouter>
  );

describe('Home', () => {
  beforeEach(() => {
    setStorage(createStorage());
  });

  it('links to the schedule builder on first visit', () => {
    renderHome();

    const banner = screen.getByRole('link', {
      name: /new schedule builder/i,
    });

    expect(banner).toHaveAttribute('href', '/schedule-builder');
    expect(screen.getByText('Schedule builder')).toBeInTheDocument();
    expect(window.localStorage.getItem(storageKey)).toBe('true');
  });

  it('hides the schedule builder banner after it has been seen', () => {
    const { unmount } = renderHome();

    unmount();
    renderHome();

    expect(
      screen.queryByRole('link', {
        name: /new schedule builder/i,
      })
    ).not.toBeInTheDocument();
  });

  it('hides the schedule builder banner when storage is already marked seen', () => {
    window.localStorage.setItem(storageKey, 'true');

    renderHome();

    expect(
      screen.queryByRole('link', {
        name: /new schedule builder/i,
      })
    ).not.toBeInTheDocument();
  });

  it('does not render the schedule builder banner when storage cannot be read', () => {
    setStorage({
      ...createStorage(),
      getItem: () => {
        throw new Error('foo');
      },
    });

    renderHome();

    expect(
      screen.queryByRole('link', {
        name: /new schedule builder/i,
      })
    ).not.toBeInTheDocument();
  });

  it('does not crash when storage cannot be written', () => {
    setStorage({
      ...createStorage(),
      setItem: () => {
        throw new Error('foo');
      },
    });

    expect(() => renderHome()).not.toThrow();
    expect(
      screen.getByRole('link', {
        name: /new schedule builder/i,
      })
    ).toBeInTheDocument();
  });
});
