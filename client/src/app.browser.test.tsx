import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

const testUserId = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const visible = (element: HTMLElement) => element.offsetParent !== null;

describe('App', () => {
  beforeEach(async () => {
    window.localStorage.clear();

    const id = testUserId();

    const response = await fetch('/api/auth/test-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        mail: `${id}@mail.mcgill.ca`,
      }),
    });

    expect(response.status).toBe(204);
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

  it('adds a course review and shows it on the profile', async () => {
    const user = userEvent.setup();
    const content = 'foo bar';

    navigate('/course/comp-202');

    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'COMP 202' })
    ).toBeInTheDocument();

    const leaveReview = (
      await screen.findAllByRole('button', { name: 'Leave a review' })
    ).find(visible);

    expect(leaveReview).toBeDefined();

    await user.click(leaveReview!);

    const dialog = await screen.findByRole('dialog');
    const form = within(dialog);
    const instructor = form.getByRole('combobox', { name: 'Instructor(s)' });

    await user.type(instructor, 'Jonathan');
    await user.click(
      await form.findByRole('option', { name: 'Jonathan Campbell' })
    );
    await user.click(
      form.getByRole('button', { name: 'Set rating to 4 out of 5' })
    );
    await user.click(
      form.getByRole('button', { name: 'Set difficulty to 3 out of 5' })
    );
    await user.type(
      form.getByPlaceholderText('Write your thoughts on this course...'),
      content
    );
    await user.click(form.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText(content).some(visible)).toBe(true);
    });

    navigate('/profile');

    expect(await screen.findByText('Your Profile')).toBeInTheDocument();
    expect(await screen.findByText('1 review')).toBeInTheDocument();
    expect(await screen.findByText(content)).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'COMP 202' })
    ).toHaveAttribute('href', '/course/comp-202');
  });
});
