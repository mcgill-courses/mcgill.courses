import { RefreshCw } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type ResetButtonProps = {
  className?: string;
  size?: number;
  onClear: () => void;
};

export const ResetButton = ({
  size = 20,
  className,
  onClear,
}: ResetButtonProps) => {
  return (
    <div
      className={twMerge(
        'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition duration-200 hover:bg-gray-100 dark:hover:bg-neutral-700',
        className ?? ''
      )}
    >
      <button onClick={onClear}>
        <RefreshCw
          size={size}
          className={'cursor-pointer text-gray-500 dark:text-neutral-400'}
        />
      </button>
    </div>
  );
};
