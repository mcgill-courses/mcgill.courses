import { escapeRegExp } from '../lib/utils';

export const Highlight = ({
  text,
  query,
  className,
}: {
  text: string;
  query?: string;
  className?: string;
}) => {
  if (!query) {
    return <span className={className}>{text}</span>;
  }

  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return <span className={className}>{text}</span>;
  }

  const queryRegex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'gi');

  const normalizedQuery = trimmedQuery.toLowerCase();

  return (
    <span className={className}>
      {text.split(queryRegex).map((part, index) => {
        const isMatch = part.toLowerCase().trim() === normalizedQuery;

        return (
          <span key={index} className={isMatch ? 'underline' : undefined}>
            {part}
          </span>
        );
      })}
    </span>
  );
};
