import { ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export const JumpToTopButton = () => {
  const [visible, setVisible] = useState(false);

  const toggleVisible = () => setVisible(window.scrollY > 300);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  window.addEventListener('scroll', toggleVisible);

  return (
    <button
      className={twMerge(
        !visible ? 'opacity-0' : 'opacity-100',
        'fixed bottom-20 right-10 z-50 rounded-full bg-gray-200 p-5 transition duration-150 ease-in-out hover:bg-gray-300 dark:bg-neutral-700 dark:text-gray-100 dark:hover:bg-neutral-600'
      )}
      disabled={!visible}
      onClick={scrollToTop}
    >
      <ArrowUp size={20} />
    </button>
  );
};
