import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

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

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );

describe('Home', () => {
  it('renders the home page', () => {
    renderHome();

    expect(
      screen.getByText(
        'Explore thousands of course and professor reviews from McGill students'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('course-search-bar')).toBeInTheDocument();
  });
});
