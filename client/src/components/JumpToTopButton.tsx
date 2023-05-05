import { useState } from 'react';
import { FaArrowUp } from 'react-icons/fa';

export const JumpToTopButton = () => {
  const [visible, setVisible] = useState(false);

  const toggleVisible = () => {
    if (window.scrollY > 300) setVisible(true);
    else setVisible(false);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  window.addEventListener('scroll', toggleVisible);

  return visible ? (
    <button
      className={`fixed bottom-10 right-10 z-50 rounded-full bg-gray-100 p-5 transition duration-150 ease-in-out hover:bg-gray-200 dark:bg-neutral-700 dark:text-gray-100 dark:hover:bg-neutral-600`}
      onClick={scrollToTop}
    >
      <FaArrowUp size={20} />
    </button>
  ) : null;
};
