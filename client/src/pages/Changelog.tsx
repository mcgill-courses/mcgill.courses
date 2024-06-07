import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import changelogItems from '../assets/changelog.json';
import { Layout } from '../components/Layout';
import { ChangelogItem } from '../model/ChangelogItem';

const typedChangelogItems: Record<string, ChangelogItem[]> = changelogItems;

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

export const Changelog = () => {
  const sortedChangelogItems = sortChangelogItems(typedChangelogItems);
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

      <div className='flex flex-col items-center py-8'>
        <div className='mb-16'>
          <h1 className='text-center text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-200 sm:text-5xl'>
            Changelog
          </h1>
          <p className='mt-2 text-center text-sm text-gray-600 dark:text-gray-400 md:text-base'>
            Check out what the development team has been shipping each month.
          </p>
        </div>
        <div className='w-full max-w-4xl px-4 sm:px-6 lg:px-8'>
          {sortedChangelogItems.map(([month, items]) => (
            <div key={month} className='mb-8'>
              <h2 className='text-2xl font-semibold text-gray-900 dark:text-gray-200'>
                {month}
              </h2>
              {items
                .slice(0, expandedMonths.includes(month) ? items.length : 5)
                .map((item, index) => (
                  <div key={index} className='mt-4'>
                    <p className='text-lg text-gray-800 dark:text-gray-300'>
                      - {item.summary.replace('/^- /', '')} (
                      <a
                        href={item.url}
                        className='text-blue-600 dark:text-blue-400'
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        #{item.number}
                      </a>
                      )
                    </p>
                  </div>
                ))}
              {items.length > 10 && (
                <button
                  onClick={() => toggleShowAll(month)}
                  className='mt-4 underline dark:text-gray-400'
                >
                  {expandedMonths.includes(month) ? 'Show less' : 'Show all'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};
