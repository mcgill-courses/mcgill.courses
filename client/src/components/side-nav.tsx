import { Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';
import { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import { useAuth } from '../hooks/use-auth';
import { useDarkMode } from '../hooks/use-dark-mode';
import { env } from '../lib/env';
import { DarkModeToggle } from './dark-mode-toggle';
import { navigationItems } from './footer';
import { Logo } from './logo';

type OverlayProps = {
  children: React.ReactNode;
};

const Overlay = ({ children }: OverlayProps) => {
  const root = document.getElementById('overlay-root');
  if (!root) {
    throw new Error('Overlay root element not present in document');
  }
  return ReactDOM.createPortal(children, root);
};

type SideNavProps = {
  open: boolean;
  onClose: (open: boolean) => void;
};

export const SideNav = ({ open, onClose }: SideNavProps) => {
  const user = useAuth();

  const [darkMode] = useDarkMode();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : 'auto';
  }, [open]);

  return (
    <Transition appear show={open}>
      <Overlay>
        <div
          className={twMerge(
            'fixed inset-0 z-50 flex h-screen items-end justify-end',
            darkMode ? 'dark' : ''
          )}
        >
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-300'
            enterFrom='opacity-0'
            enterTo='opacity-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
          >
            <div className='fixed inset-0' onClick={() => onClose(false)}>
              <div className='absolute inset-0 bg-black opacity-60'></div>
            </div>
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter='transform ease-in-out transition duration-500 sm:duration-300'
            enterFrom='translate-x-full'
            enterTo='translate-x-0'
            leave='transform ease-in-out transition duration-300'
            leaveFrom='translate-x-0'
            leaveTo='translate-x-full'
          >
            <div className='z-[999] h-screen w-full overflow-y-auto bg-white p-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10 dark:bg-neutral-800'>
              <div className='mt-1 flex items-center justify-between'>
                <div className='flex items-center'>
                  <Link to='/'>
                    <Logo size={32} />
                  </Link>
                  <div className='ml-6'>
                    <DarkModeToggle />
                  </div>
                </div>
                <button
                  type='button'
                  className='mr-2 rounded-2xl p-1 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-700'
                  onClick={() => onClose(false)}
                >
                  <span className='sr-only'>Close menu</span>
                  <XMarkIcon className='size-6' aria-hidden='true' />
                </button>
              </div>
              <div className='mt-6 flow-root'>
                <div className='-my-6 divide-y divide-gray-500/10'>
                  <div className='space-y-2 py-6'>
                    {navigationItems.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className='-mx-3 block rounded-lg px-3 py-2 text-base leading-7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-700'
                        onClick={() => onClose(false)}
                      >
                        {item.name}
                      </Link>
                    ))}
                    <Link
                      key={'privacy'}
                      to={'/privacy'}
                      className='-mx-3 block rounded-lg px-3 py-2 text-base leading-7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-700'
                    >
                      Privacy Policy
                    </Link>
                    <Link
                      key={'tos'}
                      to={'/tos'}
                      className='-mx-3 block rounded-lg px-3 py-2 text-base leading-7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-700'
                    >
                      Terms and Conditions
                    </Link>
                  </div>
                  <div className='py-6'>
                    {user ? (
                      <>
                        <Link
                          to='/profile'
                          className='-mx-3 block rounded-lg px-3 py-2.5 text-base leading-7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-700'
                        >
                          Profile
                        </Link>
                        <a
                          href={`${env.VITE_API_URL}/api/auth/logout?redirect=${
                            window.location.origin
                          }`}
                          className='-mx-3 block rounded-lg px-3 py-2.5 text-base leading-7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-700'
                        >
                          Log out
                        </a>
                      </>
                    ) : (
                      <a
                        href={`${env.VITE_API_URL}/api/auth/login?redirect=${
                          window.location.href
                        }`}
                        className='-mx-3 block rounded-lg px-3 py-2.5 text-base leading-7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-700'
                      >
                        Log in
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Overlay>
    </Transition>
  );
};
