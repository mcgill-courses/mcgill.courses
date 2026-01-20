import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import { vi } from 'vitest';

import type { Course } from '../lib/types';
import {
  ReviewForm,
  ReviewFormInitialValues,
  ReviewSchema,
} from './review-form';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

vi.mock('lucide-react', () => ({
  Flame: (props: Record<string, unknown>) => (
    <svg data-testid='flame-icon' {...props} />
  ),
}));

vi.mock('./bird-icon', () => ({
  BirdIcon: (props: Record<string, unknown>) => (
    <svg data-testid='bird-icon' {...props} />
  ),
}));

vi.mock('./icon-rating-input', () => ({
  IconRatingInput: ({
    name,
    rating,
    setFieldValue,
  }: {
    name: string;
    rating: number;
    icon: unknown;
    setFieldValue: (field: string, value: number) => void;
  }) => (
    <div data-testid={`rating-input-${name}`}>
      <span data-testid={`rating-value-${name}`}>{rating}</span>
      <button
        type='button'
        data-testid={`set-${name}-btn`}
        onClick={() => setFieldValue(name, 5)}
      >
        Set {name} to 5
      </button>
    </div>
  ),
}));

vi.mock('./multi-select', () => ({
  MultiSelect: ({
    options,
    values,
    setValues,
  }: {
    options: string[];
    values: string[];
    setValues: (values: string[]) => void;
  }) => (
    <div data-testid='multi-select'>
      {options.map((opt) => (
        <button
          key={opt}
          type='button'
          data-testid={`select-${opt}`}
          onClick={() => setValues([...values, opt])}
        >
          {opt}
        </button>
      ))}
      <span data-testid='selected-values'>{values.join(', ')}</span>
    </div>
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
  terms: ['Fall 2023', 'Winter 2024'],
  instructors: [{ name: 'Alice Smith', term: '' }],
  prerequisites: [],
  corequisites: [],
  leadingTo: [],
  restrictions: '',
  schedule: [],
  avgRating: 0,
  avgDifficulty: 0,
  reviewCount: 0,
};

const defaultInitialValues: ReviewFormInitialValues = {
  content: '',
  instructors: [],
  rating: 0,
  difficulty: 0,
};

type TestHarnessProps = {
  course?: Course;
  initialValues?: ReviewFormInitialValues;
  onSubmit?: (values: ReviewFormInitialValues) => void;
};

const TestHarness = ({
  course = mockCourse,
  initialValues = defaultInitialValues,
  onSubmit = vi.fn(),
}: TestHarnessProps) => (
  <Formik
    initialValues={initialValues}
    validationSchema={ReviewSchema}
    onSubmit={onSubmit}
  >
    {({ values, setFieldValue, resetForm }) => (
      <Form>
        <ReviewForm
          course={course}
          values={values}
          setFieldValue={setFieldValue}
          resetForm={resetForm}
        />
      </Form>
    )}
  </Formik>
);

describe('ReviewSchema', () => {
  const validBase = {
    content: 'Great course!',
    instructors: ['Alice Smith'],
    rating: 4,
    difficulty: 3,
  };

  it('requires content', async () => {
    await expect(
      ReviewSchema.validate({ ...validBase, content: '' })
    ).rejects.toThrow('Review content is required');
  });

  it('enforces max content length of 3000 characters', async () => {
    await expect(
      ReviewSchema.validate({
        ...validBase,
        content: 'a'.repeat(3001),
      })
    ).rejects.toThrow('Must be less than 3000 characters');
  });

  it('requires at least one instructor', async () => {
    await expect(
      ReviewSchema.validate({ ...validBase, instructors: [] })
    ).rejects.toThrow('At least 1 instructor is required');
  });

  it('requires rating between 1 and 5', async () => {
    await expect(
      ReviewSchema.validate({ ...validBase, rating: 0 })
    ).rejects.toThrow('Rating must be between 1 and 5');

    await expect(
      ReviewSchema.validate({ ...validBase, rating: 6 })
    ).rejects.toThrow('Rating must be between 1 and 5');
  });

  it('requires difficulty between 1 and 5', async () => {
    await expect(
      ReviewSchema.validate({ ...validBase, difficulty: 0 })
    ).rejects.toThrow('Difficulty must be between 1 and 5');

    await expect(
      ReviewSchema.validate({ ...validBase, difficulty: 6 })
    ).rejects.toThrow('Difficulty must be between 1 and 5');
  });

  it('accepts valid input', async () => {
    await expect(ReviewSchema.validate(validBase)).resolves.toEqual(validBase);
  });
});

describe('ReviewForm', () => {
  it('renders instructor options from course', () => {
    render(<TestHarness />);

    expect(screen.getByTestId('select-Alice Smith')).toBeInTheDocument();
    expect(screen.getByTestId('select-Other')).toBeInTheDocument();
  });

  it('renders rating and difficulty inputs', () => {
    render(<TestHarness />);

    expect(screen.getByTestId('rating-input-rating')).toBeInTheDocument();
    expect(screen.getByTestId('rating-input-difficulty')).toBeInTheDocument();
  });

  it('renders content textarea', () => {
    render(<TestHarness />);

    expect(
      screen.getByPlaceholderText('Write your thoughts on this course...')
    ).toBeInTheDocument();
  });

  it('renders Discard and Submit buttons', () => {
    render(<TestHarness />);

    expect(screen.getByText('Discard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('resets form when Discard is clicked', async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    const textarea = screen.getByPlaceholderText(
      'Write your thoughts on this course...'
    );

    expect(textarea).toHaveValue('');

    await user.type(textarea, 'Some new content');

    expect(textarea).toHaveValue('Some new content');

    await user.click(screen.getByText('Discard'));

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('deduplicates instructor names', async () => {
    const courseWithDuplicates: Course = {
      ...mockCourse,
      instructors: [
        { name: 'Alice Smith', term: 'Fall 2023' },
        { name: 'Alice Smith', term: 'Winter 2024' },
        { name: 'Bob Jones', term: 'Fall 2023' },
      ],
    };

    render(<TestHarness course={courseWithDuplicates} />);

    await waitFor(() => {
      const aliceButtons = screen.getAllByTestId('select-Alice Smith');
      expect(aliceButtons).toHaveLength(1);
    });

    expect(screen.getByTestId('select-Bob Jones')).toBeInTheDocument();
  });
});

describe('FormikPersist', () => {
  it('loads saved values from localStorage on mount', async () => {
    const savedValues: ReviewFormInitialValues = {
      content: 'Saved draft content',
      instructors: ['Alice Smith'],
      rating: 4,
      difficulty: 3,
    };

    localStorage.setItem('COMP202', JSON.stringify(savedValues));

    render(<TestHarness />);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(
        'Write your thoughts on this course...'
      );

      expect(textarea).toHaveValue('Saved draft content');
    });
  });

  it('saves values to localStorage when they change', async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    const textarea = screen.getByPlaceholderText(
      'Write your thoughts on this course...'
    );

    await user.type(textarea, 'New content');

    await waitFor(() => {
      const saved = localStorage.getItem('COMP202');
      expect(saved).not.toBeNull();

      const parsed = JSON.parse(saved!);
      expect(parsed.content).toBe('New content');
    });
  });

  it('does not overwrite saved values on initial mount', async () => {
    const savedValues: ReviewFormInitialValues = {
      content: 'Previously saved content',
      instructors: ['Alice Smith'],
      rating: 5,
      difficulty: 2,
    };

    localStorage.setItem('COMP202', JSON.stringify(savedValues));

    render(<TestHarness />);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(
        'Write your thoughts on this course...'
      );

      expect(textarea).toHaveValue('Previously saved content');
    });

    const saved = localStorage.getItem('COMP202');
    const parsed = JSON.parse(saved!);

    expect(parsed.content).toBe('Previously saved content');
  });
});
