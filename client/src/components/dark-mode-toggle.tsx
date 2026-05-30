import { Moon, Sun } from 'lucide-react';

import { useDarkMode } from '../hooks/use-dark-mode';

export const DarkModeToggle = () => {
  const [darkMode, setDarkMode] = useDarkMode();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <button
      onClick={toggleDarkMode}
      className='cursor-pointer rounded-2xl p-1.5 hover:bg-gray-50 dark:hover:bg-neutral-700'
    >
      {darkMode ? (
        <Sun className='size-6 fill-gray-400 stroke-gray-400 stroke-2' />
      ) : (
        <Moon className='size-6 stroke-neutral-500 stroke-2' />
      )}
    </button>
  );
};
