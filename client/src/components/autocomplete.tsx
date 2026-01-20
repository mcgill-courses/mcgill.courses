import { Combobox, Transition } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

type AutocompleteProps<T extends string> = {
  options: readonly T[];
  value?: T;
  setValue: (value: T) => void;
  className?: string;
  inputClassName?: string;
};

export const Autocomplete = <T extends string>({
  options,
  value,
  setValue,
  className,
  inputClassName,
}: AutocompleteProps<T>) => {
  const [query, setQuery] = useState('');

  const filtered =
    query !== ''
      ? options.filter((x) => {
          return x.toLowerCase().includes(query.toLowerCase());
        })
      : options;

  return (
    <div className={className}>
      <Combobox value={value} onChange={(val) => setValue(val)}>
        <div className='w-full'>
          <div className='relative max-w-[240px] rounded-md border border-neutral-200 bg-slate-200 p-2 dark:border-neutral-600 dark:bg-neutral-700'>
            <Combobox.Input
              className={twMerge(
                'w-[87.5%] bg-slate-200 text-sm outline-none dark:bg-neutral-700 dark:text-gray-200 dark:caret-white',
                inputClassName
              )}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Combobox.Button className='absolute inset-y-0 flex w-full items-center'>
              <ChevronDown
                className='mr-4 ml-auto size-5 text-gray-400'
                aria-hidden='true'
              />
            </Combobox.Button>
          </div>
          <Transition
            enter='transition duration-100 ease-out'
            enterFrom='transform scale-95 opacity-0'
            enterTo='transform scale-100 opacity-100'
            leave='transition duration-75 ease-out'
            leaveFrom='transform scale-100 opacity-100'
            leaveTo='transform scale-95 opacity-0'
          >
            <Combobox.Options className='autocomplete absolute max-h-80 w-full max-w-[240px] overflow-scroll rounded-md text-sm shadow-md'>
              {filtered.map((val, i) => (
                <Combobox.Option
                  key={i}
                  value={val}
                  className={({ active }) =>
                    twMerge(
                      'min-h-[32px] cursor-pointer p-2 text-gray-900 dark:text-gray-200',
                      active
                        ? 'bg-gray-100 dark:bg-neutral-500'
                        : 'bg-white dark:bg-neutral-600'
                    )
                  }
                >
                  {val}
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
    </div>
  );
};
