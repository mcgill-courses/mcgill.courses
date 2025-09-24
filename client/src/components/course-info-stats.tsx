import _ from 'lodash';
import { Flame, LucideIcon } from 'lucide-react';
import { ComponentType, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

import { useMediaQuery } from '../hooks/use-media-query';
import type { Review } from '../lib/types';
import { round2Decimals } from '../lib/utils';
import { BirdIcon } from './bird-icon';
import { Histogram } from './histogram';

type Size = 'small' | 'medium' | 'large';

type CourseInfoStatsProps = {
  reviews: Review[];
  className?: string;
  variant?: Size;
};

type FillBarProps = {
  width: number;
  percentage: number;
  text?: string;
  variant?: Size;
};

const FillBar = ({ width, percentage, text, variant }: FillBarProps) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div
      className={twMerge(
        'relative overflow-hidden rounded-md bg-gray-300 dark:bg-gray-600',
        variant === 'large' ? 'h-5' : 'h-4'
      )}
      style={{ width }}
    >
      <div
        className={twMerge(
          'bg-red-500 transition-all duration-1000 ease-in-out',
          variant === 'large' ? 'h-5' : 'h-4'
        )}
        style={{ width: !loaded ? 0 : (percentage / 100) * width }}
      />
      <div className='absolute inset-y-0 flex w-full justify-center text-sm font-bold leading-4 text-white'>
        {text}
      </div>
    </div>
  );
};

type StatProps = {
  title: string;
  value: number;
  icon: LucideIcon | ComponentType<any>;
  variant: Size;
};

const Stat = ({ title, value, icon: Icon, variant }: StatProps) => {
  return (
    <div>
      <div className='flex items-center gap-x-1'>
        <Icon className='-mt-0.5 stroke-red-600' size={18} />
        <div
          className={twMerge(
            'mb-0.5 text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400'
          )}
        >
          {title}
        </div>
      </div>
      <div className='py-0.5' />
      <div className='flex items-center gap-x-2'>
        <FillBar
          width={variant === 'small' ? 144 : 180}
          percentage={value * 20}
          text={`${value}/5`}
          variant={variant}
        />
      </div>
    </div>
  );
};

export const CourseInfoStats = ({
  reviews,
  className,
  variant = 'small',
}: CourseInfoStatsProps) => {
  const lg = useMediaQuery('(min-width: 1024px)');

  if (reviews.length === 0) {
    return null;
  }

  const ratings = reviews.map((r) => r.rating);
  const averageRating = _.sum(ratings) / reviews.length;
  const difficulties = reviews.map((r) => r.difficulty);
  const averageDifficulty = _.sum(difficulties) / reviews.length;

  return (
    <div
      className={twMerge(
        'flex gap-x-4 bg-transparent',
        variant === 'large'
          ? 'flex-col gap-y-1 lg:flex-row lg:gap-x-2'
          : 'flex-row',
        className
      )}
    >
      <div className='md:rounded-xl md:p-2'>
        <Stat
          title='Rating'
          value={round2Decimals(averageRating)}
          icon={BirdIcon}
          variant={variant}
        />
        <div className='py-2' />
        <Histogram
          width={180}
          height={lg ? 132 : 80}
          data={ratings}
          max={5}
          gap={10}
          className='mx-auto hidden sm:block'
        />
      </div>
      <div className='py-1.5' />
      <div className='md:rounded-xl md:p-2'>
        <Stat
          title='Difficulty'
          value={round2Decimals(averageDifficulty)}
          icon={Flame}
          variant={variant}
        />
        <div className='py-2' />
        <Histogram
          width={180}
          height={lg ? 132 : 80}
          data={difficulties}
          max={5}
          gap={10}
          className='mx-auto hidden sm:block'
        />
      </div>
    </div>
  );
};
