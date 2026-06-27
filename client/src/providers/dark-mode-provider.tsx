import {
  PropsWithChildren,
  createContext,
  useLayoutEffect,
  useState,
} from 'react';

export const DarkModeContext = createContext<
  [boolean, (darkMode: boolean) => void] | undefined
>(undefined);

export const DarkModeProvider = ({ children }: PropsWithChildren) => {
  const [darkMode, setDark] = useState(
    window.localStorage.getItem('theme') === 'dark'
  );

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const setDarkMode = (dark: boolean) => {
    setDark(dark);
    window.localStorage.setItem('theme', dark ? 'dark' : 'light');
  };

  return (
    <DarkModeContext.Provider value={[darkMode, setDarkMode]}>
      {children}
    </DarkModeContext.Provider>
  );
};
