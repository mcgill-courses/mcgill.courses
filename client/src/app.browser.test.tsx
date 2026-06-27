import { cleanup, render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from './app';
import AuthProvider from './providers/auth-provider';
import { DarkModeProvider } from './providers/dark-mode-provider';
import ExploreFilterStateProvider from './providers/explore-filter-state-provider';
import QueryProvider from './providers/query-provider';
import { routerFutureConfig } from './testing/router-wrapper';

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

describe('App', () => {
  beforeEach(async () => {
    window.localStorage.clear();

    const response = await fetch('/api/auth/test-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'foo',
        mail: 'foo@mail.mcgill.ca',
      }),
    });

    expect(response.status).toBe(204);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('visits the root route', async () => {
    window.history.replaceState(null, '', '/');

    renderApp();

    expect(
      await screen.findByText(
        'Explore thousands of course and professor reviews from McGill students'
      )
    ).toBeInTheDocument();
  });

  it('visits the authenticated profile route', async () => {
    window.history.replaceState(null, '', '/profile');

    renderApp();

    expect(await screen.findByText('Your Profile')).toBeInTheDocument();
    expect(await screen.findByText('0 reviews')).toBeInTheDocument();
    expect(await screen.findByText('0 liked reviews')).toBeInTheDocument();
    expect(await screen.findByText('0 subscriptions')).toBeInTheDocument();
  });
});
