import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

import { NavItem } from './nav-item';

export const navigationItems = [
  { name: 'Home', href: '/' },
  { name: 'About', href: '/about' },
  { name: 'Changelog', href: '/changelog' },
  { name: 'Explore', href: '/explore' },
  { name: 'Reviews', href: '/reviews' },
  { name: 'Schedule Builder', href: '/schedule-builder' },
];

export const Footer = () => {
  const [visible, setVisible] = useState(false);
  const [isScrollable, setIsScrollable] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const checkPageScrollable = () => {
      return document.documentElement.scrollHeight > window.innerHeight;
    };

    const checkScrollability = () => {
      const scrollable = checkPageScrollable();
      setIsScrollable(scrollable);
      if (!scrollable) {
        setVisible(true);
      }
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      if (Math.abs(scrollDelta) < 5) return;

      setVisible(scrollDelta > 0);

      lastScrollY.current = currentScrollY;
    };

    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', checkScrollability);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <nav
      className={twMerge(
        'fixed bottom-0 left-0 z-40 hidden h-16 w-full flex-row items-center justify-between bg-slate-100 lg:flex dark:bg-neutral-900',
        isScrollable && 'transition-transform duration-300 ease-in-out',
        isScrollable && !visible ? 'translate-y-full' : 'translate-y-0'
      )}
    >
      <div className='ml-10 flex flex-row'>
        {navigationItems.map((item) => (
          <div key={item.name} className='mx-3'>
            <NavItem name={item.name} href={item.href} key={item.name} />
          </div>
        ))}
      </div>
      <div className='mr-10 space-x-6'>
        <NavItem name={'Privacy Policy'} href={'/privacy'} />
        <NavItem name={'Terms and Conditions'} href={'/tos'} />
      </div>
    </nav>
  );
};
