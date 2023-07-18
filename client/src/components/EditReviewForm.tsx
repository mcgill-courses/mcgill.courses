import { Dialog, Transition } from '@headlessui/react';
import { Form, Formik } from 'formik';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

import { useDarkMode } from '../hooks/useDarkMode';
import { fetchClient } from '../lib/fetchClient';
import { Course } from '../model/Course';
import { Review } from '../model/Review';
import { ReviewForm, ReviewSchema } from './ReviewForm';

type EditReviewFormProps = {
  course: Course;
  review: Review;
  open: boolean;
  onClose: () => void;
  handleSubmit: (res: Response) => void;
};

export const EditReviewForm = ({
  course,
  review,
  open,
  onClose,
  handleSubmit,
}: EditReviewFormProps) => {
  const [darkMode] = useDarkMode();

  const initialValues = {
    content: review.content,
    instructors: review.instructors,
    rating: review.rating,
    difficulty: review.difficulty,
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as='div'
        className={twMerge('relative z-50', darkMode ? 'dark' : '')}
        onClose={onClose}
      >
        <Transition.Child
          as={Fragment}
          enter='ease-out duration-200'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='fixed inset-0 bg-black/25' />
        </Transition.Child>

        <div className='fixed inset-y-0 left-0 w-screen overflow-y-auto'>
          <div className='flex min-h-full items-center justify-center p-4 text-center'>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-200'
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave='ease-in duration-150'
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <Dialog.Panel className='w-[448px] overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-neutral-800'>
                <Dialog.Title
                  as='h3'
                  className='mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-200'
                >
                  {`Editing review of ${course._id} - ${course.title}`}
                </Dialog.Title>

                <Formik
                  initialValues={initialValues}
                  validationSchema={ReviewSchema}
                  onSubmit={async (values, actions) => {
                    const res = await fetchClient.put(
                      `/reviews`,
                      {
                        course_id: course._id,
                        ...values,
                      },
                      { headers: { 'Content-Type': 'application/json' } }
                    );
                    actions.setSubmitting(false);
                    onClose();
                    handleSubmit(res);
                  }}
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
