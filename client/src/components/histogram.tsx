import { useEffect, useMemo, useState } from 'react';
import { twMerge } from 'tailwind-merge';

import { Tooltip } from './ui/tooltip';

type HistogramProps = {
  data: number[];
  max: number;
  width: number;
  height: number;
  gap?: number;
  className?: string;
  tooltipText?: (count: number) => string;
};

type HistogramBarProps = {
  width: number;
  height: number;
  count: number;
  gap: number;
  tooltipText: (count: number) => string;
};

const HistogramBar = ({
  width,
  height,
  count,
  gap,
  tooltipText,
}: HistogramBarProps) => {
  return (
    <Tooltip text={tooltipText(count)} offset={{ x: 4, y: -8 }}>
      <div
        className='bg-mcgill-red ml-0.5 rounded-t-md shadow-sm shadow-red-500/15 transition-all duration-700 ease-out dark:bg-red-500 dark:shadow-red-500/10'
        style={{
          width,
          height,
          marginLeft: gap / 2,
          marginRight: gap / 2,
        }}
      />
    </Tooltip>
  );
};

export const Histogram = ({
  data,
  max,
  width,
  height,
  gap = 4,
  className,
  tooltipText = (count) => count.toString(),
}: HistogramProps) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  const distribution = useMemo(
    () =>
      data.reduce((acc, curr) => {
        acc[curr - 1]++;
        return acc;
      }, Array(max).fill(0)),
    [data]
  );

  const chartHeight = height - 14;
  const total = data.length || 1;

  return (
    <div className={twMerge('relative w-fit pt-1', className)}>
      <div
        className='pointer-events-none absolute inset-x-0 top-1 bottom-4 flex flex-col justify-between'
        aria-hidden='true'
      >
        {[0, 1, 2].map((line) => (
          <div
            key={line}
            className='h-px bg-gray-200/80 dark:bg-neutral-700/70'
          />
        ))}
      </div>
      <div className='relative flex items-end' style={{ width, height }}>
        {distribution.map((count, index) => (
          <div key={index} className='flex flex-col items-center text-xs'>
            <HistogramBar
              width={width / distribution.length - gap}
              height={!loaded ? 0 : (count / total) * chartHeight}
              count={count}
              gap={gap}
              tooltipText={tooltipText}
            />
            <div className='mt-1 font-medium text-gray-500 tabular-nums dark:text-gray-400'>
              {index + 1}
            </div>
          </div>
        ))}
      </div>
      <div className='absolute bottom-4 h-px w-full bg-gray-300 dark:bg-neutral-600' />
    </div>
  );
};
