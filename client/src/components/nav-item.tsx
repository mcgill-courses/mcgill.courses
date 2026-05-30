import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

type NavItemProps = {
  name: string;
  href: string;
};

export const NavItem = ({ name, href }: NavItemProps) => {
  const redUnderlineStyle =
    'before:content before:absolute before:block before:w-full before:h-[2px] before:bottom-0 before:left-0 before:top-5 before:bg-red-600';

  return (
    <Link
      to={href}
      className={twMerge(
        'relative text-sm leading-6 font-semibold text-gray-900 dark:text-gray-200',
        redUnderlineStyle,
        location.pathname !== href
          ? 'before:origin-top-left before:scale-x-0 before:transition before:duration-300 before:ease-in-out before:hover:scale-x-100'
          : ''
      )}
    >
      {name}
    </Link>
  );
};
