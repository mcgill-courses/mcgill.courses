import { Disclosure } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { PropsWithChildren } from 'react';
import { twMerge } from 'tailwind-merge';

export const FilterToggle = ({ children }: PropsWithChildren) => {
  return (
    <Disclosure>
      {({ open }) => (
        <div>
          <Disclosure.Button className='flex w-full justify-between rounded-lg bg-slate-200 px-4 py-2 text-red-500 dark:bg-neutral-700'>
            <h1 className='text-sm font-medium text-gray-600 dark:text-gray-400'>
              Filter...
            </h1>
            <ChevronDown
              className={twMerge(
                open ? 'rotate-180 transform' : '',
                'h-5 w-5 text-gray-500'
              )}
            />
          </Disclosure.Button>
          <Disclosure.Panel>
            <div className='py-1' />
            {children}
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  );
};
