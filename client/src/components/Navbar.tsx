import { Bars3Icon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { fetchClient } from '../lib/fetchClient';
import { Course } from '../model/Course';
import { SearchResults } from '../model/SearchResults';
import { CourseSearchBar } from './CourseSearchBar';
import { NavItem } from './NavItem';
import { ProfileDropdown } from './ProfileDropdown';
import { SideNav } from './SideNav';

export const navigation = [
  { name: 'Explore', href: '/explore' },
  { name: 'About', href: '/about' },
];

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [results, setResults] = useState<SearchResults>({
    query: '',
    courses: [],
  });

  const location = useLocation();
  const pathName = location.pathname;

  const handleInputChange = async (query: string) => {
    try {
      setResults({
        query,
        courses: await fetchClient.getData<Course[]>(
          `/search?query=${encodeURIComponent(query)}`
        ),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const user = useAuth();

  return (
    <header className='z-50'>
      <nav
        className='flex items-center justify-between p-6 lg:px-8'
        aria-label='Global'
      >
        <div className='my-auto mr-auto flex lg:flex-1'>
          <Link to='/' className='-m-1.5 p-1.5'>
            <img className='h-12 w-auto' src='/bird.png' alt='bird' />
          </Link>
        </div>
        <div className='flex lg:hidden'>
          <button
            type='button'
            className='-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700'
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className='sr-only'>Open main menu</span>
            <Bars3Icon className='h-6 w-6' aria-hidden='true' />
          </button>
        </div>
        {pathName !== '/' ? (
          <div className='my-auto hidden flex-1 justify-center align-middle lg:flex'>
            <CourseSearchBar
              results={results}
              handleInputChange={handleInputChange}
            />
          </div>
        ) : null}
        <div className='ml-6 flex min-w-fit flex-row lg:flex-1'>
          <div className='my-auto hidden lg:ml-auto lg:flex lg:gap-x-12'>
            {navigation.map((item) => (
              <NavItem name={item.name} href={item.href} key={item.name} />
            ))}
          </div>
          <div className='hidden lg:ml-12 lg:flex lg:justify-end'>
            {user ? (
              <ProfileDropdown />
            ) : (
              <a
                href={`${import.meta.env.VITE_API_URL}/auth/login`}
                className='text-sm font-semibold leading-6 text-gray-900'
              >
                Log in <span aria-hidden='true'>&rarr;</span>
              </a>
            )}
          </div>
        </div>
      </nav>
      <SideNav open={mobileMenuOpen} onClose={setMobileMenuOpen} />
    </header>
  );
};
