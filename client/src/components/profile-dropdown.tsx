import { Menu, Transition } from '@headlessui/react';
import { ChevronRight, User } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

import { env } from '../lib/env';

interface MenuItemProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

const MenuItem: React.FC<MenuItemProps> = ({ href, onClick, children }) => {
  return (
    <Menu.Item>
      {({ active }) => {
        const className = twMerge(
          active
            ? 'bg-gray-100 text-gray-900 dark:bg-neutral-700 dark:text-gray-200 rounded-lg'
            : 'text-gray-700 dark:bg-neutral-800 dark:text-gray-200',
          'flex items-center justify-between px-3 py-2 text-sm w-full text-left cursor-pointer'
        );

        const icon = href && active && <ChevronRight size={20} />;

        return href ? (
          <Link to={href} className={className}>
            {children}
            {icon}
          </Link>
        ) : (
          <button onClick={onClick} className={className}>
            {children}
            {icon}
          </button>
        );
      }}
    </Menu.Item>
  );
};

export const ProfileDropdown = () => {
  return (
    <Menu as='div' className='relative inline-block text-left'>
      <div>
        <Menu.Button className='cursor-pointer rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700'>
          <User className='size-5 dark:text-gray-400' aria-hidden='true' />
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter='transition ease-out duration-100'
        enterFrom='transform opacity-0 scale-95'
        enterTo='transform opacity-100 scale-100'
        leave='transition ease-in duration-75'
        leaveFrom='transform opacity-100 scale-100'
        leaveTo='transform opacity-0 scale-95'
      >
        <Menu.Items className='absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-neutral-800 dark:text-gray-200'>
          <div className='mx-2 my-1 py-1'>
            <MenuItem href='/profile'>Profile</MenuItem>
            <MenuItem
              onClick={() =>
                (window.location.href = `${env.VITE_API_URL}/api/auth/logout?redirect=%2F`)
              }
            >
              Log out
            </MenuItem>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};
