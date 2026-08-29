import { ErrorMessage, Field, FormikState, useFormikContext } from 'formik';
import { Flame } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { PropsWithChildren } from 'react';
import * as Yup from 'yup';

import type { AddOrUpdateReviewBody, Course } from '../lib/types';
import { compareTerms, getCurrentTerm, getRecentTerms } from '../lib/utils';
import { BirdIcon } from './bird-icon';
import { IconRatingInput } from './icon-rating-input';
import { MultiSelect } from './ui/multi-select';
import { Select } from './ui/select';

export const ReviewSchema = Yup.object().shape({
  content: Yup.string()
    .required('Review content is required')
    .max(3000, 'Must be less than 3000 characters'),
  instructors: Yup.array().min(1, 'At least 1 instructor is required'),
  rating: Yup.number()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5')
    .required('Rating is required'),
  difficulty: Yup.number()
    .min(1, 'Difficulty must be between 1 and 5')
    .max(5, 'Difficulty must be between 1 and 5')
    .required('Difficulty is required'),
  term: Yup.string(),
});

type FieldErrorProps = {
  name: string;
};

const FieldError = ({ name }: FieldErrorProps) => (
  <div className='text-sm text-red-400 italic'>
    <ErrorMessage name={name} />
  </div>
);

type FieldLabelProps = {
  htmlFor: string;
};

const FieldLabel = ({
  htmlFor,
  children,
}: PropsWithChildren<FieldLabelProps>) => (
  <label
    htmlFor={htmlFor}
    className='mt-4 mb-1 text-xs tracking-wider text-gray-500 uppercase dark:text-gray-400'
  >
    {children}
  </label>
);

export type ReviewFormInitialValues = Omit<AddOrUpdateReviewBody, 'course_id'>;

const FormikPersist = ({ name }: { name: string }) => {
  const { values, setValues } = useFormikContext<ReviewFormInitialValues>();

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;

      const saved = localStorage.getItem(name);

      if (saved) {
        setValues(JSON.parse(saved));
      }
    } else {
      localStorage.setItem(name, JSON.stringify(values));
    }
  }, [name, values, setValues]);

  return null;
};

type ReviewFormProps = {
  course: Course;
  setFieldValue: (
    field: string,
    value: string | string[] | number,
    shouldValidate?: boolean | undefined
  ) => void;
  values: ReviewFormInitialValues;
  resetForm: (
    nextState?: Partial<FormikState<ReviewFormInitialValues>> | undefined
  ) => void;
};

export const ReviewForm = ({
  course,
  setFieldValue,
  values,
  resetForm,
}: ReviewFormProps) => {
  const instructorNames = Array.from(
    new Set(course.instructors.map((instructor) => instructor.name))
  );

  instructorNames.push('Other');

  const termOptions: string[] = Array.from(
    new Set([...course.terms, ...getRecentTerms()])
  ).sort(compareTerms);

  return (
    <>
      <FieldLabel htmlFor='instructors'>Instructor(s)</FieldLabel>
      <MultiSelect
        className='mt-2'
        id='instructors'
        inputClassName='bg-neutral-100'
        options={instructorNames}
        setValues={(instructors) => setFieldValue('instructors', instructors)}
        values={values.instructors}
      />
      <FieldError name='instructors' />

      <FieldLabel htmlFor='term'>Term</FieldLabel>
      <Select
        className='mt-2'
        options={termOptions}
        value={values.term ?? getCurrentTerm()}
        setValue={(term) => setFieldValue('term', term)}
      />

      <div className='flex gap-x-10'>
        <div className='flex flex-col gap-y-1'>
          <FieldLabel htmlFor='rating'>Rating</FieldLabel>
          <IconRatingInput
            name='rating'
            rating={values.rating}
            icon={BirdIcon}
            setFieldValue={setFieldValue}
          />
        </div>
        <div className='flex flex-col gap-y-0.5'>
          <FieldLabel htmlFor='difficulty'>Difficulty</FieldLabel>
          <IconRatingInput
            name='difficulty'
            rating={values.difficulty}
            icon={Flame}
            setFieldValue={setFieldValue}
          />
        </div>
      </div>
      <FieldError name='rating' />
      <FieldError name='difficulty' />
      <div className='py-1' />
      <div className='flex flex-col'>
        <FieldLabel htmlFor='content'>Content</FieldLabel>
        <Field
          component='textarea'
          rows='8'
          id='content'
          name='content'
          placeholder='Write your thoughts on this course...'
          className='resize-none rounded-md border border-neutral-200 bg-gray-50 p-3 outline-none dark:border-neutral-600 dark:bg-neutral-700 dark:text-gray-200 dark:caret-white'
        />
        <FieldError name='content' />
        <div className='mt-8 flex justify-end space-x-4'>
          <button
            type='button'
            onClick={() => resetForm()}
            className='w-fit cursor-pointer rounded-md bg-gray-100 px-4 py-2 font-medium text-gray-700 duration-200 hover:bg-gray-200 dark:bg-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-600'
          >
            Discard
          </button>
          <button
            type='submit'
            className='ml-auto w-fit cursor-pointer rounded-md bg-red-600 px-4 py-2 font-medium text-white transition duration-300 hover:bg-red-800'
          >
            Submit
          </button>
        </div>
        <FormikPersist name={course._id} />
      </div>
    </>
  );
};
