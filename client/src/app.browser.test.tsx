import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './app';
import { DarkModeProvider } from './providers/dark-mode-provider';

vi.mock('./lib/search-index', () => ({
  getSearchIndex: () => ({
    courses: [],
    instructors: [],
    coursesIndex: { search: () => [] },
    instructorsIndex: { search: () => [] },
  }),
  updateSearchResults: vi.fn(),
}));

vi.mock('./components/course-search-bar', () => ({
  CourseSearchBar: () => <div data-testid='course-search-bar' />,
}));

describe('App', () => {
  it('should visit the root and display homepage text', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <DarkModeProvider>
          <App />
        </DarkModeProvider>
      </MemoryRouter>
    );
    expect(
      await screen.findByText(
        /Explore thousands of course and professor reviews from McGill students/i
      )
    ).toBeVisible();
  });
});