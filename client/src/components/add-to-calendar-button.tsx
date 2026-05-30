import { CalendarPlus } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import {
  type IcsEventOptions,
  buildIcsContent,
  downloadIcsFile,
} from '../lib/calendar';

type CalendarPayload = {
  filename: string;
  events: IcsEventOptions[];
  prodId?: string;
};

type AddToCalendarButtonProps = {
  payload: CalendarPayload | null;
  ariaLabel: string;
  title?: string;
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
  variant?: 'default' | 'ghost';
};

const variantClasses: Record<'default' | 'ghost', string> = {
  default:
    'inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200 dark:hover:bg-neutral-900 sm:flex-none sm:self-start',
  ghost:
    'inline-flex items-center gap-1.5 self-start rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-slate-200/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-300 hover:dark:bg-neutral-700/60 sm:flex-none sm:self-start',
};

export const AddToCalendarButton = ({
  payload,
  ariaLabel,
  title,
  className,
  iconClassName,
  disabled,
  variant = 'default',
}: AddToCalendarButtonProps) => {
  const isDisabled = disabled || !payload || payload.events.length === 0;

  const handleClick = () => {
    if (!payload || isDisabled) return;

    const { events, filename, prodId } = payload;
    const content = buildIcsContent({ events, prodId });
    downloadIcsFile(filename, content);
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={isDisabled}
      className={twMerge('cursor-pointer', variantClasses[variant], className)}
      aria-label={ariaLabel}
      title={title}
    >
      <CalendarPlus className={twMerge('size-4', iconClassName)} aria-hidden />
    </button>
  );
};
