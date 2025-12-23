import { screen } from '@testing-library/react';

import { CourseCard } from '../components/course-card';
import type { Course } from '../lib/types';
import { renderWithRouter } from '../testing/router-wrapper';

describe('CourseCard', () => {
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
    terms: ['Fall 2023', 'Winter 2024'],
    instructors: [],
    prerequisites: [],
    corequisites: [],
    leadingTo: [],
    restrictions: '',
    schedule: [],
    avgRating: 0,
    avgDifficulty: 0,
    reviewCount: 0,
  };

  it('renders course code and title', () => {
    renderWithRouter(<CourseCard course={mockCourse} className='test-class' />);

    expect(
      screen.getByText('COMP 202 - Foundations of Programming')
    ).toBeInTheDocument();
  });

  it('truncates long descriptions', () => {
    const longDescription = 'a'.repeat(500);

    const courseWithLongDesc = { ...mockCourse, description: longDescription };

    renderWithRouter(
      <CourseCard course={courseWithLongDesc} className='test-class' />
    );

    // Should be truncated to 400 chars + ...
    expect(screen.getByText(`${'a'.repeat(400)} ...`)).toBeInTheDocument();
  });

  it('highlights searched text when query provided', () => {
    renderWithRouter(
      <CourseCard
        course={mockCourse}
        className='test-class'
        query='programming'
      />
    );

    const element = screen.getByText('programming');

    // The programming text should be wrapped in a span with underline
    expect(element.tagName).toBe('SPAN');
    expect(element).toHaveClass('underline');
  });

  it('links to correct course page', () => {
    renderWithRouter(<CourseCard course={mockCourse} className='test-class' />);

    const link = screen.getByRole('link');

    expect(link).toHaveAttribute('href', '/course/comp-202');
  });

  it('applies className prop', () => {
    renderWithRouter(
      <CourseCard course={mockCourse} className='custom-class' />
    );

    const link = screen.getByRole('link');

    expect(link).toHaveClass('custom-class');
  });
});
