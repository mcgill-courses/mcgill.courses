import { XCircle } from 'lucide-react';
import { FallbackProps, getErrorMessage } from 'react-error-boundary';

import { Layout } from '../components/layout';

export const ErrorPage = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <Layout>
      <div className='mt-32 flex h-screen justify-center'>
        <div className='text-center'>
          <div>
            <div className='text-xl text-gray-700 dark:text-gray-300'>
              Something went wrong :(
            </div>
            <div className='py-1.5' />
            <XCircle
              className='mx-auto stroke-gray-400 dark:stroke-gray-600'
              size={40}
              strokeWidth={2}
            />
          </div>
          <div className='py-4' />
          <div className='text-red-700 dark:text-red-400'>
            {getErrorMessage(error)}
          </div>
          <div className='py-6' />
          <button
            className='mx-auto rounded-lg border border-gray-300 px-3 py-2 text-gray-900 duration-200 hover:bg-gray-300 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'
            onClick={resetErrorBoundary}
          >
            Try again
          </button>
          <div className='py-3' />
          <div className='text-sm dark:text-gray-200'>
            Help us fix it by reporting this error with a screenshot on{' '}
            <a
              className='text-red-700 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
              href='https://github.com/terror/mcgill.courses'
            >
              our GitHub
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
};
