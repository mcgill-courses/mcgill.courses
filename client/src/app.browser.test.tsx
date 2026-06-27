import { cleanup, render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    window.history.replaceState(null, '', '/');

    window.localStorage.clear();

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const requestUrl =
          input instanceof Request ? input.url : input.toString();

        if (requestUrl.endsWith('/api/user')) {
          return Promise.resolve(
            new Response(JSON.stringify({}), {
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }

        return Promise.resolve(new Response(null, { status: 404 }));
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('visits the root route', async () => {
    renderApp();

    expect(
      await screen.findByText(
        'Explore thousands of course and professor reviews from McGill students'
      )
    ).toBeInTheDocument();
  });
});
