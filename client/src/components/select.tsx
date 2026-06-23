import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

type SelectProps<T extends string> = {
  options: readonly T[];
  value: T;
  setValue: (value: T) => void;
  className?: string;
  buttonClassName?: string;
};

export const Select = <T extends string>({
  options,
  value,
  setValue,
  className,
  buttonClassName,
}: SelectProps<T>) => (
  <div className={twMerge('relative w-full max-w-[240px]', className)}>
    <Listbox value={value} onChange={setValue}>
      <Listbox.Button
        className={twMerge(
          'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-xs border border-gray-300 bg-gray-100 px-3 py-2 text-left text-sm font-medium text-gray-900 shadow-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-gray-700 dark:bg-neutral-800 dark:text-gray-200',
          buttonClassName
        )}
      >
        <span className='truncate'>{value}</span>
        <ChevronDown
          aria-hidden='true'
          className='size-4 shrink-0 text-gray-500 dark:text-gray-400'
        />
      </Listbox.Button>
      <Transition
        as={Fragment}
        enter='transition duration-100 ease-out'
        enterFrom='transform scale-95 opacity-0'
        enterTo='transform scale-100 opacity-100'
        leave='transition duration-75 ease-out'
        leaveFrom='transform scale-100 opacity-100'
        leaveTo='transform scale-95 opacity-0'
      >
        <Listbox.Options className='styled-scrollbar absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-xs bg-white text-sm shadow-md ring-1 ring-slate-200 outline-none dark:bg-neutral-800 dark:ring-neutral-700'>
          {options.map((option) => (
            <Listbox.Option
              className={({ active }) =>
                twMerge(
                  'cursor-pointer px-3 py-2 text-gray-900 dark:text-gray-200',
                  active && 'bg-gray-100 dark:bg-neutral-700'
                )
              }
              key={option}
              value={option}
            >
              {({ selected }) => (
                <span
                  className={twMerge(
                    'block truncate',
                    selected && 'font-medium'
                  )}
                >
                  {option}
                </span>
              )}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </Transition>
    </Listbox>
  </div>
);
