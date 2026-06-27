import { AnimatePresence, m } from 'framer-motion';
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  GitPullRequest,
} from 'lucide-react';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import changelogItems from '../assets/changelog.json';
import { Layout } from '../components/layout';

export interface ChangelogItem {
  number: number;
  summary?: string;
  url: string;
  mergedAt: string;
}

const typedChangelogItems: Record<string, ChangelogItem[]> = changelogItems;

type ChangelogItemWithSummary = ChangelogItem & {
  summary: string;
};

const visibleItemCount = 5;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const parseMonthString = (monthString: string): Date => {
  const [month, year] = monthString.split(' ');
  return new Date(`${month} 1, ${year}`);
};

const sortChangelogItems = (
  items: Record<string, ChangelogItem[]>
): [string, ChangelogItem[]][] => {
  return Object.entries(items).sort(([a], [b]) => {
    const dateA = parseMonthString(a);
    const dateB = parseMonthString(b);
    return dateB.getTime() - dateA.getTime();
  });
};

const sanitizeChangelogItems = (
  items: ChangelogItem[]
): ChangelogItemWithSummary[] => {
  return items.flatMap((item) => {
    const summary = item.summary?.trim().replace(/^- /, '');

    if (!summary) return [];

    return [
      {
        ...item,
        summary,
      },
    ];
  });
};

const formatMergedAt = (mergedAt: string) => {
  return dateFormatter.format(new Date(mergedAt));
};

const monthToId = (month: string) => {
  return `changelog-${month.toLowerCase().replace(/\s+/g, '-')}`;
};

export const Changelog = () => {
  const sortedChangelogItems = sortChangelogItems(typedChangelogItems)
    .map(
      ([month, items]) =>
        [month, sanitizeChangelogItems(items)] as [
          string,
          ChangelogItemWithSummary[],
        ]
    )
    .filter(([, items]) => items.length > 0);

  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);

  const toggleShowAll = (month: string) => {
    setExpandedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  return (
    <Layout>
      <Helmet>
        <title>Changelog - mcgill.courses</title>
        <meta property='og:type' content='website' />
        <meta property='og:url' content={`https://mcgill.courses/changelog`} />
        <meta property='og:title' content={`Changelog - mcgill.courses`} />
        <meta
          property='twitter:url'
          content={`https://mcgill.courses/changelog`}
        />
        <meta property='twitter:title' content={`Changelog - mcgill.courses`} />
      </Helmet>

      <div className='mx-auto max-w-5xl px-2 py-10 sm:px-4 lg:py-14'>
        <div className='mx-auto max-w-3xl text-center'>
          <h1 className='text-4xl font-bold text-gray-950 sm:text-5xl dark:text-gray-100'>
            Changelog
          </h1>
          <p className='mt-3 text-sm leading-6 text-gray-600 md:text-base dark:text-gray-400'>
            Check out what the development team has been shipping each month.
          </p>
        </div>

        <div className='mt-12 space-y-12'>
          {sortedChangelogItems.map(([month, items]) => {
            const expanded = expandedMonths.includes(month);

            const visibleItems = items.slice(0, visibleItemCount);
            const remainingItems = items.slice(visibleItemCount);

            const headingId = monthToId(month);

            const renderItem = (item: ChangelogItemWithSummary) => (
              <div key={item.number} className='relative'>
                <span
                  className='absolute top-5 -left-[1.1rem] flex size-3 items-center justify-center rounded-full bg-white ring-4 ring-slate-100 dark:bg-neutral-900 dark:ring-neutral-900'
                  aria-hidden='true'
                >
                  <span className='size-2 rounded-full bg-gray-500 dark:bg-gray-400' />
                </span>
                <div className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition duration-150 hover:border-slate-300 hover:shadow-md sm:p-5 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600'>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <p className='text-base leading-7 text-gray-800 dark:text-gray-200'>
                      {item.summary}
                    </p>
                    <a
                      href={item.url}
                      className='inline-flex shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-gray-700 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900'
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      <GitPullRequest className='size-4' aria-hidden='true' />#
                      {item.number}
                      <ExternalLink className='size-3.5' aria-hidden='true' />
                    </a>
                  </div>
                  <time
                    dateTime={item.mergedAt}
                    className='mt-3 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400'
                  >
                    <CalendarDays className='size-4' aria-hidden='true' />
                    {formatMergedAt(item.mergedAt)}
                  </time>
                </div>
              </div>
            );

            return (
              <section
                key={month}
                aria-labelledby={headingId}
                className='relative mx-auto max-w-3xl'
              >
                <div>
                  <h2
                    id={headingId}
                    className='text-2xl font-semibold text-gray-950 dark:text-gray-100'
                  >
                    {month}
                  </h2>
                  <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                    {items.length} {items.length === 1 ? 'update' : 'updates'}
                  </p>
                </div>

                <div className='relative mt-4 pl-5'>
                  <div
                    className='absolute top-2 bottom-0 left-1.5 w-px bg-slate-200 dark:bg-neutral-700'
                    aria-hidden='true'
                  />
                  <div className='space-y-3'>
                    {visibleItems.map(renderItem)}
                    <AnimatePresence initial={false}>
                      {expanded && remainingItems.length > 0 && (
                        <m.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className='space-y-3 overflow-hidden'
                        >
                          {remainingItems.map(renderItem)}
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {items.length > visibleItemCount && (
                    <button
                      type='button'
                      onClick={() => toggleShowAll(month)}
                      className='group mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700'
                    >
                      <m.div
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className='size-4' aria-hidden='true' />
                      </m.div>
                      {expanded ? 'Show less' : 'Show all'}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};
