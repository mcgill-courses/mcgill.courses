import { Bars3Icon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import birdImageUrl from '../assets/bird.png';
import { useAuth } from '../hooks/useAuth';
import { fetchClient } from '../lib/fetchClient';
import { getUrl } from '../lib/utils';
import { SearchResults } from '../model/SearchResults';
import { CourseSearchBar } from './CourseSearchBar';
import { DarkModeToggle } from './DarkModeToggle';
import { ProfileDropdown } from './ProfileDropdown';
import { SideNav } from './SideNav';

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [arrowColor, setArrowColor] = useState(
    'text-gray-900 dark:text-gray-200'
  );

  const [results, setResults] = useState<SearchResults>({
    query: '',
    courses: [],
    instructors: [],
  });

  const location = useLocation();
  const pathName = location.pathname;

  const handleInputChange = async (query: string) => {
    try {
      setResults({
        query,
        ...(await fetchClient.getData<SearchResults>(
          `/search?query=${encodeURIComponent(query)}`
        )),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const user = useAuth();

  return (
    <header className='z-40'>
      <nav
        className='z-40 flex items-center justify-between p-3 lg:px-8'
        aria-label='Global'
      >
        <div className='z-40 my-auto mr-auto flex lg:flex-1'>
          <Link to='/' className='-m-1.5 p-1.5'>
            <img className='h-12 w-auto' src={birdImageUrl} alt='bird' />
          </Link>
        </div>
        {pathName !== '/' ? (
          <div className='mx-8 my-auto hidden flex-1 justify-center align-middle sm:mx-12 sm:block md:mx-32'>
            <CourseSearchBar
              results={results}
              handleInputChange={handleInputChange}
            />
          </div>
        ) : null}
        <div className='flex lg:hidden'>
          <button
            type='button'
            className='inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-gray-200'
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className='sr-only'>Open main menu</span>
            <Bars3Icon className='h-6 w-6' aria-hidden='true' />
          </button>
        </div>
        <div className='flex min-w-fit flex-row lg:flex-1'>
          <div className='my-auto hidden lg:ml-auto lg:flex lg:items-center lg:gap-x-8'>
            <DarkModeToggle />
          </div>
          <div className='hidden lg:ml-5 lg:flex lg:justify-end'>
            {user ? (
              <ProfileDropdown />
            ) : (
              <a
                href={`${getUrl()}/api/auth/login?redirect=${
                  window.location.href
                }`}
                className='my-auto text-sm font-semibold leading-6 text-gray-900 dark:text-gray-200'
                onMouseEnter={() => setArrowColor('text-red-600')}
                onMouseLeave={() =>
                  setArrowColor('text-gray-900 dark:text-gray-200')
                }
              >
                Log in{' '}
                <span className={arrowColor} aria-hidden='true'>
                  &rarr;
                </span>{' '}
              </a>
            )}
          </div>
        </div>
      </nav>
      <SideNav open={mobileMenuOpen} onClose={setMobileMenuOpen} />
    </header>
  );
};
