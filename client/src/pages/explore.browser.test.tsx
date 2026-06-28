import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LazyMotion, domAnimation } from 'framer-motion';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../app';
import AuthProvider from '../providers/auth-provider';
import { DarkModeProvider } from '../providers/dark-mode-provider';
import ExploreFilterStateProvider from '../providers/explore-filter-state-provider';
import QueryProvider from '../providers/query-provider';
import { routerFutureConfig } from '../testing/router-wrapper';

const login = async (id = crypto.randomUUID()) => {
  const response = await fetch('/api/auth/test-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      mail: `${id}@mail.mcgill.ca`,
    }),
  });

  expect(response.status).toBe(204);
};

const navigate = (path: string) => {
  act(() => {
    window.history.replaceState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
};

const renderApp = () =>
  render(
    <HelmetProvider>
      <BrowserRouter future={routerFutureConfig}>
        <DarkModeProvider>
          <LazyMotion features={domAnimation}>
            <QueryProvider>
              <AuthProvider>
                <ExploreFilterStateProvider>
                  <Toaster richColors />
                  <App />
                </ExploreFilterStateProvider>
              </AuthProvider>
            </QueryProvider>
          </LazyMotion>
        </DarkModeProvider>
      </BrowserRouter>
    </HelmetProvider>
  );

describe('Explore page', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await login();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('renders courses from the server', async () => {
    navigate('/explore');

    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Explore all courses' })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('link', {
        name: 'COMP 202 - Foundations of Programming',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'COMP 252 - Honours Algorithms and Data Structures',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'MATH 240 - Discrete Structures',
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/all 3 courses/)).toBeInTheDocument();
  });

  it('searches courses by query', async () => {
    const user = userEvent.setup();

    navigate('/explore');

    renderApp();

    await screen.findByRole('link', { name: /COMP 202/ });

    expect(screen.getByText(/all 3 courses/)).toBeInTheDocument();

    const searchBar = screen.getByPlaceholderText(
      'Search by course, subject, or professor'
    );

    await user.type(searchBar, 'math');

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: /MATH 240/ })
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('link', { name: /COMP 202/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /COMP 252/ })
    ).not.toBeInTheDocument();

    expect(screen.getByText(/all 1 courses/)).toBeInTheDocument();
  });
});
