import { Dialog, Transition } from '@headlessui/react';
import { Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { twMerge } from 'tailwind-merge';

type DeleteButtonProps = {
  title: string;
  text: string;
  onConfirm: () => void;
  size: number;
  className?: string;
};

export const DeleteButton = ({
  title,
  text,
  onConfirm,
  size = 20,
  className,
}: DeleteButtonProps) => {
  const [open, setOpen] = useState(false);

  const onDeleteClick = () => {
    setOpen(false);
    onConfirm();
  };

  return (
    <>
      <button
        type='button'
        className={twMerge('h-fit cursor-pointer', className)}
        onClick={() => setOpen(true)}
      >
        <Trash2
          className='stroke-gray-500 transition duration-200 hover:stroke-red-600 dark:stroke-gray-400 dark:hover:stroke-red-600'
          size={size}
        />
      </button>
      <Transition appear show={open} as={Fragment}>
        <Dialog
          as='div'
          className='relative z-50'
          onClose={() => setOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-200'
            enterFrom='opacity-0'
            enterTo='opacity-100'
            leave='ease-in duration-150'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
          >
            <div className='fixed inset-0 bg-black/25' />
          </Transition.Child>

          <div className='fixed inset-y-0 left-0 w-screen overflow-y-auto'>
            <div className='flex min-h-full items-center justify-center p-4 text-center'>
              <Transition.Child
                as={Fragment}
                enter='ease-out duration-200'
                enterFrom='opacity-0 scale-95'
                enterTo='opacity-100 scale-100'
                leave='ease-in duration-150'
                leaveFrom='opacity-100 scale-100'
                leaveTo='opacity-0 scale-95'
              >
                <Dialog.Panel className='w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-neutral-800'>
                  <Dialog.Title
                    as='h3'
                    className='text-lg leading-6 font-medium text-gray-900 dark:text-gray-200'
                  >
                    {title}
                  </Dialog.Title>
                  <div className='mt-2'>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      {text}
                    </p>
                  </div>

                  <div className='mt-4 flex justify-end space-x-3'>
                    <button
                      type='button'
                      className='cursor-pointer rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:bg-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-600'
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type='button'
                      className='cursor-pointer rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:bg-red-500 dark:text-gray-200 dark:hover:bg-red-600'
                      onClick={onDeleteClick}
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};
