import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { api } from '../lib/api';
import type { Course } from '../lib/types';
import { Explore } from './explore';

vi.mock('../lib/api', () => ({
  api: {
    getCourses: vi.fn(),
  },
}));

vi.mock('../hooks/use-explore-filter-state', () => ({
  useExploreFilterState: () => ({
    selectedSubjects: [],
    selectedLevels: [],
    selectedTerms: [],
    sortBy: '',
  }),
}));

vi.mock('../components/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/explore-filter', () => ({
  ExploreFilter: () => <div data-testid='explore-filter' />,
}));

vi.mock('../components/filter-toggle', () => ({
  FilterToggle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='filter-toggle'>{children}</div>
  ),
}));

vi.mock('../components/jump-to-top-button', () => ({
  JumpToTopButton: () => <div data-testid='jump-to-top' />,
}));

vi.mock('../components/course-card', () => ({
  CourseCard: ({ course }: { course: Course }) => (
    <div data-testid={`course-card-${course._id}`}>{course.title}</div>
  ),
}));

vi.mock('../components/search-bar', () => ({
  SearchBar: () => <input data-testid='search-bar' />,
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-infinite-scroll-component', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='infinite-scroll'>{children}</div>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const getCoursesMock = api.getCourses as Mock;

const createMockCourse = (id: string): Course => ({
  _id: id,
  title: `Course ${id}`,
  description: 'Test description',
  subject: 'COMP',
  code: id.replace('COMP', ''),
  credits: '3',
  url: '',
  department: 'Computer Science',
  faculty: 'Science',
  terms: ['Fall 2023'],
  instructors: [],
  prerequisites: [],
  corequisites: [],
  leadingTo: [],
  restrictions: '',
  schedule: [],
  avgRating: 4,
  avgDifficulty: 3,
  reviewCount: 10,
});

describe('Explore page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton initially', () => {
    getCoursesMock.mockReturnValue(new Promise(() => {}));

    render(<Explore />);

    expect(screen.queryByTestId('search-bar')).not.toBeInTheDocument();
  });

  it('renders courses after successful fetch', async () => {
    const courses = [createMockCourse('COMP202'), createMockCourse('COMP250')];
    getCoursesMock.mockResolvedValue({ courses, courseCount: 2 });

    render(<Explore />);

    await waitFor(() => {
      expect(screen.getByTestId('course-card-COMP202')).toBeInTheDocument();
      expect(screen.getByTestId('course-card-COMP250')).toBeInTheDocument();
    });

    expect(screen.getByText(/2 courses/)).toBeInTheDocument();
  });

  it('shows error toast when fetch fails', async () => {
    const { toast } = await import('sonner');
    getCoursesMock.mockRejectedValue(new Error('Network error'));

    render(<Explore />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to fetch courses, please try again later'
      );
    });
  });

  it('calls getCourses with correct parameters', async () => {
    const courses = [createMockCourse('COMP202')];
    getCoursesMock.mockResolvedValue({ courses, courseCount: 1 });

    render(<Explore />);

    await waitFor(() => {
      expect(screen.getByTestId('course-card-COMP202')).toBeInTheDocument();
    });

    expect(getCoursesMock).toHaveBeenCalledWith(
      20,
      0,
      true,
      expect.objectContaining({
        levels: undefined,
        query: undefined,
        sortReverse: undefined,
        sortType: undefined,
        subjects: undefined,
        terms: undefined,
      })
    );
  });
});
