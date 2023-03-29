import { useState } from 'react';

import { CourseSearchBar } from '../components/CourseSearchBar';
import { Layout } from '../components/Layout';
import { fetchClient } from '../lib/fetchClient';
import { Course } from '../model/course';

export const Home = () => {
  const [results, setResults] = useState<Course[]>([]);

  const handleInputChange = async (query: string) => {
    try {
      setResults(
        await fetchClient.getData<Course[]>(
          `/search?query=${encodeURIComponent(query)}`
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout>
      <div className='relative isolate px-6 pt-14 lg:px-8'>
        <div className='mx-auto max-w-2xl py-32 sm:py-48 lg:py-56'>
          <div className='hidden sm:mb-8 sm:flex sm:justify-center'></div>
          <div className='text-center'>
            <h1 className='text-left text-5xl font-bold tracking-tight text-gray-900 sm:text-5xl'>
              Explore thousands of course and professor reviews from McGill
              students
            </h1>
            <CourseSearchBar
              results={results}
              handleInputChange={handleInputChange}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};
