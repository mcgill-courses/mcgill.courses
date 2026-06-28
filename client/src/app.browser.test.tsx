import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const navigate = (path: string) => {
  act(() => {
    window.history.replaceState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
};

const testLogin = async (id = crypto.randomUUID()) => {
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

describe('App', () => {
  beforeEach(async () => {
    window.localStorage.clear();

    await testLogin('foo');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('visits the root route', async () => {
    navigate('/');

    renderApp();

    expect(
      await screen.findByText(
        'Explore thousands of course and professor reviews from McGill students'
      )
    ).toBeInTheDocument();
  });

  it('visits the authenticated profile route', async () => {
    navigate('/profile');

    renderApp();

    expect(await screen.findByText('Your Profile')).toBeInTheDocument();
    expect(await screen.findByText('0 reviews')).toBeInTheDocument();
    expect(await screen.findByText('0 liked reviews')).toBeInTheDocument();
    expect(await screen.findByText('0 subscriptions')).toBeInTheDocument();
  });

  it('subscribes from a course page and shows the subscription on the profile', async () => {
    const user = userEvent.setup();

    await testLogin();

    navigate('/course/comp-202');

    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'COMP 202' })
    ).toBeInTheDocument();

    const subscribe = await screen.findByRole('button', {
      name: 'Subscribe to COMP 202',
    });

    await waitFor(() => expect(subscribe).toBeEnabled());
    await user.click(subscribe);

    expect(
      await screen.findByRole('button', { name: 'Unsubscribe from COMP 202' })
    ).toBeInTheDocument();

    navigate('/profile');

    expect(await screen.findByText('1 subscription')).toBeInTheDocument();

    await user.click(await screen.findByRole('tab', { name: 'Subscriptions' }));

    expect(
      await screen.findByRole('link', { name: 'COMP202' })
    ).toHaveAttribute('href', '/course/comp-202');
  });
});
