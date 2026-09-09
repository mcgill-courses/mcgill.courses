import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';

import type { Course, Review } from '../lib/types';
import { ReviewFilter } from './review-filter';

vi.mock('./ui/autocomplete', () => ({
  Autocomplete: ({
    value,
    setValue,
    options,
  }: {
    value: string;
    setValue: (v: string) => void;
    options: string[];
  }) => (
    <select
      value={value}
      onChange={(e) => setValue(e.target.value)}
      data-testid='autocomplete'
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('./ui/reset-button', () => ({
  ResetButton: ({ onClear }: { onClear: () => void }) => (
    <button onClick={onClear} data-testid='reset-button'>
      Reset
    </button>
  ),
}));

const mockCourse: Course = {
  _id: 'COMP202',
  title: 'Foundations of Programming',
  description: 'A basic introduction to programming.',
  subject: 'COMP',
  code: '202',
  credits: '3',
  url: '',
  department: 'Computer Science',
  faculty: 'Science',
  terms: ['Fall 2023'],
  instructors: [{ name: 'Alice Smith', term: 'Fall 2023' }],
  prerequisites: [],
  corequisites: [],
  leadingTo: [],
  restrictions: '',
  schedule: [],
  avgRating: 0,
  avgDifficulty: 0,
  reviewCount: 0,
};

const mockReviews: Review[] = [
  {
    content: 'Great course, loved the exams',
    courseId: 'COMP202',
    difficulty: 3,
    instructors: ['Alice Smith'],
    likes: 5,
    rating: 4,
    timestamp: '1700000000',
    userId: 'user1',
  },
  {
    content: 'Very hard assignments but rewarding',
    courseId: 'COMP202',
    difficulty: 5,
    instructors: ['Alice Smith'],
    likes: 2,
    rating: 3,
    timestamp: '1700000001',
    userId: 'user2',
  },
  {
    content: 'Easy and fun, great professor',
    courseId: 'COMP202',
    difficulty: 1,
    instructors: ['Alice Smith'],
    likes: 8,
    rating: 5,
    timestamp: '1700000002',
    userId: 'user3',
  },
];

describe('ReviewFilter', () => {
  it('renders the search input', () => {
    const setReviews = vi.fn();
    const setShowAllReviews = vi.fn();
    const setSelectedInstructor = vi.fn();
    const setSortBy = vi.fn();
    const setSearchQuery = vi.fn();
    const setStatsReviews = vi.fn();

    render(
      <ReviewFilter
        course={mockCourse}
        allReviews={mockReviews}
        sortBy='Most Recent'
        selectedInstructor=''
        searchQuery=''
        setReviews={setReviews}
        setShowAllReviews={setShowAllReviews}
        setSelectedInstructor={setSelectedInstructor}
        setSortBy={setSortBy}
        setSearchQuery={setSearchQuery}
        setStatsReviews={setStatsReviews}
      />
    );

    expect(
      screen.getByPlaceholderText('Search reviews...')
    ).toBeInTheDocument();
  });

  it('filters reviews by search query', async () => {
    const user = userEvent.setup();
    const setReviews = vi.fn();
    const setShowAllReviews = vi.fn();
    const setSelectedInstructor = vi.fn();
    const setSortBy = vi.fn();
    const setStatsReviews = vi.fn();

    const ControlledReviewFilter = () => {
      const [searchQuery, setSearchQuery] = useState('');

      return (
        <ReviewFilter
          course={mockCourse}
          allReviews={mockReviews}
          sortBy='Most Recent'
          selectedInstructor=''
          searchQuery={searchQuery}
          setReviews={setReviews}
          setShowAllReviews={setShowAllReviews}
          setSelectedInstructor={setSelectedInstructor}
          setSortBy={setSortBy}
          setSearchQuery={setSearchQuery}
          setStatsReviews={setStatsReviews}
        />
      );
    };

    render(<ControlledReviewFilter />);

    const searchInput = screen.getByPlaceholderText('Search reviews...');
    await user.type(searchInput, 'exam');

    await waitFor(() => {
      expect(setReviews).toHaveBeenLastCalledWith([mockReviews[0]]);
    });
  });

  it('clears search query on reset', async () => {
    const user = userEvent.setup();
    const setReviews = vi.fn();
    const setShowAllReviews = vi.fn();
    const setSelectedInstructor = vi.fn();
    const setSortBy = vi.fn();
    const setSearchQuery = vi.fn();
    const setStatsReviews = vi.fn();

    render(
      <ReviewFilter
        course={mockCourse}
        allReviews={mockReviews}
        sortBy='Most Recent'
        selectedInstructor=''
        searchQuery='exam'
        setReviews={setReviews}
        setShowAllReviews={setShowAllReviews}
        setSelectedInstructor={setSelectedInstructor}
        setSortBy={setSortBy}
        setSearchQuery={setSearchQuery}
        setStatsReviews={setStatsReviews}
      />
    );

    await user.click(screen.getByTestId('reset-button'));

    await waitFor(() => {
      expect(setSearchQuery).toHaveBeenCalledWith('');
    });
  });
});
