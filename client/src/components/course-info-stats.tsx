import { Flame, LucideIcon } from 'lucide-react';
import { ComponentType, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

import type { Review } from '../lib/types';
import { round2Decimals, sum } from '../lib/utils';
import { BirdIcon } from './bird-icon';
import { Histogram } from './histogram';

type Size = 'small' | 'medium' | 'large';

type CourseInfoStatsProps = {
  className?: string;
  reviews: Review[];
  variant?: Size;
};

type FillBarProps = {
  width: number;
  percentage: number;
  variant?: Size;
};

const accentStyle = {
  fill: 'bg-mcgill-red dark:bg-red-500',
  icon: 'stroke-red-600 dark:stroke-red-400',
};

const sizeStyle = {
  large: {
    width: 180,
    histogramHeight: 116,
  },
  medium: {
    width: 156,
    histogramHeight: 86,
  },
  small: {
    width: 116,
    histogramHeight: 72,
  },
};

const FillBar = ({ width, percentage, variant }: FillBarProps) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  const fillWidth = `${!loaded ? 0 : Math.min(100, percentage)}%`;

  return (
    <div
      className={twMerge(
        'relative overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700',
        variant === 'large' ? 'h-2' : 'h-1.5'
      )}
      style={{ width }}
    >
      <div
        className={twMerge(
          'h-full rounded-full transition-all duration-1000 ease-out',
          accentStyle.fill
        )}
        style={{ width: fillWidth }}
      />
    </div>
  );
};

type StatProps = {
  data: number[];
  title: string;
  value: number;
  icon: LucideIcon | ComponentType<{ className?: string; size?: number }>;
  variant: Size;
  showHistogram: boolean;
};

const Stat = ({
  data,
  title,
  value,
  icon: Icon,
  variant,
  showHistogram,
}: StatProps) => {
  const size = sizeStyle[variant];
  const percentage = value * 20;

  return (
    <div className='shrink-0' style={{ width: size.width }}>
      <div className='mb-2'>
        <div>
          <div className='flex items-center gap-x-1.5'>
            <Icon className={twMerge('-mt-0.5', accentStyle.icon)} size={18} />
            <div className='text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400'>
              {title}
            </div>
          </div>
          <div className='mt-1 flex items-baseline gap-1 text-gray-800 dark:text-gray-100'>
            <span className='text-2xl leading-none font-semibold tabular-nums'>
              {value}
            </span>
            <span className='text-xs font-medium text-gray-500 dark:text-gray-400'>
              /5
            </span>
          </div>
        </div>
      </div>
      <FillBar width={size.width} percentage={percentage} variant={variant} />
      {showHistogram && (
        <Histogram
          width={size.width}
          height={size.histogramHeight}
          data={data}
          max={5}
          gap={variant === 'large' ? 10 : 8}
          tooltipText={(count) =>
            `${count} ${count === 1 ? 'review' : 'reviews'}`
          }
          className='mx-auto mt-3'
        />
      )}
    </div>
  );
};

export const CourseInfoStats = ({
  className,
  reviews,
  variant = 'small',
}: CourseInfoStatsProps) => {
  if (reviews.length === 0) {
    return null;
  }

  const ratings = reviews.map((r) => r.rating);
  const averageRating = sum(ratings) / reviews.length;
  const difficulties = reviews.map((r) => r.difficulty);
  const averageDifficulty = sum(difficulties) / reviews.length;
  const showHistogram = variant !== 'small';

  return (
    <div
      className={twMerge(
        'flex items-start gap-x-6 gap-y-5 bg-transparent',
        className
      )}
    >
      <div>
        <Stat
          data={ratings}
          title='Rating'
          value={round2Decimals(averageRating)}
          icon={BirdIcon}
          variant={variant}
          showHistogram={showHistogram}
        />
      </div>
      <div>
        <Stat
          data={difficulties}
          title='Difficulty'
          value={round2Decimals(averageDifficulty)}
          icon={Flame}
          variant={variant}
          showHistogram={showHistogram}
        />
      </div>
    </div>
  );
};
