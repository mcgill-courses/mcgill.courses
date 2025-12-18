import { PropsWithChildren, createContext, useState } from 'react';

export const DarkModeContext = createContext<
  [boolean, (darkMode: boolean) => void] | undefined
>(undefined);

export const DarkModeProvider = ({ children }: PropsWithChildren<any>) => {
  const [darkMode, setDark] = useState(
    localStorage.getItem('theme') === 'dark'
  );

  const setDarkMode = (dark: boolean) => {
    setDark(dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  };

  return (
    <DarkModeContext.Provider value={[darkMode, setDarkMode]}>
      {children}
    </DarkModeContext.Provider>
  );
};
