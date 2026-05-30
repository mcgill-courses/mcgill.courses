import { Combobox, Transition } from '@headlessui/react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

type MultiSelectProps = {
  options: string[];
  values: string[];
  setValues: (values: string[]) => void;
  className?: string;
  inputClassName?: string;
};

export const MultiSelect = ({
  options,
  values,
  setValues,
  className,
  inputClassName,
}: MultiSelectProps) => {
  const [query, setQuery] = useState('');

  // Needed to prevent the onBlur (resetting query) from firing when just clicking an option
  const [optionClicked, setOptionClicked] = useState(false);

  const filtered =
    query === ''
      ? options
      : options.filter((x) => {
          return x.toLowerCase().includes(query.toLowerCase());
        });

  const removeVal = (val: string) => {
    setValues(values.filter((x) => x !== val));
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      if (!optionClicked) setQuery('');
      setOptionClicked(false);
    }, 200);
  };

  const handleOptionMouseDown = () => {
    setOptionClicked(true);
  };

  const handleOptionMouseUp = () => {
    setOptionClicked(false);
  };

  return (
    <div className={twMerge('w-full', className)}>
      <Combobox
        value={values}
        onChange={(val) => {
          setValues(val);
        }}
        multiple
      >
        <div className='relative max-w-[240px]'>
          <div
            className={twMerge(
              'relative rounded-md border border-neutral-200 bg-slate-200 p-2 dark:border-neutral-600 dark:bg-neutral-700',
              inputClassName
            )}
          >
            <Combobox.Input
              className={twMerge(
                'w-full bg-slate-200 text-sm outline-none dark:bg-neutral-700 dark:text-gray-200 dark:caret-white',
                inputClassName
              )}
              onChange={(event) => setQuery(event.target.value)}
              onBlur={handleInputBlur}
            />
            <Combobox.Button className='absolute inset-y-0 flex w-full cursor-pointer items-center'>
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
            <Combobox.Options className='styled-scrollbar absolute max-h-80 w-full overflow-scroll rounded-b-md text-sm shadow-md'>
              {filtered.map((val) => (
                <Combobox.Option
                  key={val}
                  value={val}
                  className={({ active }) =>
                    twMerge(
                      'cursor-pointer p-2 text-gray-900 dark:text-gray-200',
                      active
                        ? 'bg-gray-100 dark:bg-neutral-500'
                        : 'bg-white dark:bg-neutral-600'
                    )
                  }
                  onMouseDown={handleOptionMouseDown}
                  onMouseUp={handleOptionMouseUp}
                >
                  <div className='flex items-center justify-between'>
                    <div>{val}</div>
                    {values.includes(val) && (
                      <Check className='stroke-red-600' size={18} />
                    )}
                  </div>
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
      <div className='mt-2 flex w-full flex-wrap gap-1'>
        {values.map((val) => (
          <div
            key={val}
            className='flex space-x-1 rounded-3xl bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-200'
          >
            <div>{val}</div>
            <button
              type='button'
              className='cursor-pointer'
              onClick={() => removeVal(val)}
            >
              <X
                size={18}
                className='transition duration-75 hover:stroke-red-600'
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
