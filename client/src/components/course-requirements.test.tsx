import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Course } from '../lib/types';
import { renderWithRouter } from '../testing/router-wrapper';
import { CourseRequirements } from './course-requirements';

vi.mock('./course-graph', () => ({
  CourseGraph: () => <div data-testid='course-graph'>Graph View</div>,
}));

const baseCourse: Course = {
  _id: 'COMP202',
  title: 'Foundations of Programming',
  credits: '3',
  subject: 'COMP',
  code: '202',
  url: '',
  department: 'Computer Science',
  faculty: 'Science',
  terms: [],
  description: 'Course description',
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

describe('CourseRequirements', () => {
  it('renders formatted requirement text and course links', () => {
    const courseWithRequirements: Course = {
      ...baseCourse,
      prerequisitesText: 'Prerequisites: COMP 202 and MATH 133',
      corequisitesText: 'Corequisites: PHYS 101',
      restrictions: 'Restrictions: Departmental approval required',
    };

    renderWithRouter(
      <CourseRequirements
        course={courseWithRequirements}
        className='extra-class'
      />
    );

    const prereqSection = screen.getByRole('heading', {
      name: 'Prerequisites',
    }).parentElement as HTMLElement;

    const coreqSection = screen.getByRole('heading', {
      name: 'Corequisites',
    }).parentElement as HTMLElement;

    const restrictionsSection = screen.getByRole('heading', {
      name: 'Restrictions',
    }).parentElement as HTMLElement;

    expect(prereqSection).not.toHaveTextContent('Prerequisites:');
    expect(prereqSection).toHaveTextContent('COMP 202 and MATH 133.');

    expect(coreqSection).toHaveTextContent('PHYS 101.');

    expect(restrictionsSection).not.toHaveTextContent('Restrictions:');
    expect(restrictionsSection).toHaveTextContent(
      'Departmental approval required.'
    );

    expect(screen.getByRole('link', { name: 'COMP 202' })).toHaveAttribute(
      'href',
      '/course/COMP-202'
    );
    expect(screen.getByRole('link', { name: 'MATH 133' })).toHaveAttribute(
      'href',
      '/course/MATH-133'
    );
    expect(screen.getByRole('link', { name: 'PHYS 101' })).toHaveAttribute(
      'href',
      '/course/PHYS-101'
    );
  });

  it('renders fallback text when requirement sections are empty', () => {
    renderWithRouter(<CourseRequirements course={baseCourse} />);

    expect(
      screen.getByText('This course has no prerequisites.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This course has no corequisites.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This course has no restrictions.')
    ).toBeInTheDocument();
  });

  it('toggles between requirement list and graph view', async () => {
    const courseWithRequirements: Course = {
      ...baseCourse,
      prerequisitesText: 'Prerequisites: COMP 202',
      corequisitesText: 'Corequisites: PHYS 101',
      restrictions: 'Restrictions: Departmental approval required',
    };

    renderWithRouter(<CourseRequirements course={courseWithRequirements} />);

    expect(screen.queryByTestId('course-graph')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button');

    await userEvent.click(toggle);

    expect(await screen.findByTestId('course-graph')).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: 'Prerequisites' })
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.queryByTestId('course-graph')).not.toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Prerequisites' })
    ).toBeInTheDocument();
  });
});
