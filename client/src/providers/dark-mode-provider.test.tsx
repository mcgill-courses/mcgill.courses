import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useDarkMode } from '../hooks/use-dark-mode';
import { DarkModeProvider } from './dark-mode-provider';

const createStorage = (): Storage => {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear: () => {
      store = {};
    },
    getItem: (key) => store[key] ?? null,
    key: (index) => Object.keys(store)[index] ?? null,
    removeItem: (key) => {
      delete store[key];
    },
    setItem: (key, value) => {
      store[key] = value;
    },
  };
};

const Toggle = () => {
  const [darkMode, setDarkMode] = useDarkMode();

  return (
    <button type='button' onClick={() => setDarkMode(!darkMode)}>
      {darkMode ? 'dark' : 'light'}
    </button>
  );
};

beforeEach(() => {
  document.documentElement.className = '';
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createStorage(),
  });
});

it('adds the dark class from the stored theme', () => {
  window.localStorage.setItem('theme', 'dark');

  render(
    <DarkModeProvider>
      <Toggle />
    </DarkModeProvider>
  );

  expect(document.documentElement).toHaveClass('dark');
  expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
});

it('updates the dark class when dark mode changes', async () => {
  const user = userEvent.setup();

  render(
    <DarkModeProvider>
      <Toggle />
    </DarkModeProvider>
  );

  expect(document.documentElement).not.toHaveClass('dark');

  await user.click(screen.getByRole('button', { name: 'light' }));

  expect(document.documentElement).toHaveClass('dark');
  expect(window.localStorage.getItem('theme')).toBe('dark');

  await user.click(screen.getByRole('button', { name: 'dark' }));

  expect(document.documentElement).not.toHaveClass('dark');
  expect(window.localStorage.getItem('theme')).toBe('light');
});
