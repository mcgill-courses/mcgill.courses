import { Transition } from '@headlessui/react';
import type { HTMLAttributes } from 'react';
import {
  Children,
  PropsWithChildren,
  cloneElement,
  isValidElement,
  useState,
} from 'react';
import { twMerge } from 'tailwind-merge';

type TooltipProps = {
  text: string;
  offset?: { x: number; y: number };
  className?: string;
};

type TooltipChildProps = Pick<
  HTMLAttributes<HTMLElement>,
  'onMouseEnter' | 'onMouseLeave'
>;

export const Tooltip = ({
  text,
  offset = { x: 0, y: -8 },
  className,
  children,
}: TooltipProps & PropsWithChildren) => {
  const [show, setShow] = useState(false);

  const element = Children.only(children);

  if (!isValidElement<TooltipChildProps>(element)) {
    throw new Error('Tooltip must have a single child that is a React Element');
  }

  return (
    <span className='relative'>
      <Transition
        show={show && !!text}
        className={twMerge(
          'absolute z-10 min-w-fit translate-x-0 -translate-y-full rounded-md bg-white p-2 text-center text-xs font-medium text-gray-700 dark:bg-neutral-500 dark:text-gray-100',
          className
        )}
        style={{
          left: offset.x,
          top: offset.y,
        }}
        enter='transition-opacity duration-200'
        enterFrom='opacity-0'
        enterTo='opacity-100'
        leave='transition-opacity duration-200'
        leaveFrom='opacity-100'
        leaveTo='opacity-0'
      >
        <div>{text}</div>
      </Transition>
      {cloneElement(element, {
        onMouseEnter: (event) => {
          element.props.onMouseEnter?.(event);
          setShow(true);
        },
        onMouseLeave: (event) => {
          element.props.onMouseLeave?.(event);
          setShow(false);
        },
      })}
    </span>
  );
};
