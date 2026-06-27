import { useEffect } from 'react';

import { Footer } from './footer';
import { Navbar } from './navbar';

type LayoutProps = {
  children: React.ReactNode;
  preventScroll?: boolean;
};

export const Layout = ({ children, preventScroll }: LayoutProps) => {
  useEffect(() => {
    if (!preventScroll) window.scrollTo(0, 0);
  }, []);

  return (
    <div>
      <div className='min-h-screen overflow-auto bg-slate-100 pb-5 transition duration-300 ease-in-out lg:pb-20 dark:bg-neutral-900'>
        <Navbar />
        <main className='mx-2 md:mx-16 lg:mx-24 xl:mx-40'>{children}</main>
      </div>
      <Footer />
    </div>
  );
};
