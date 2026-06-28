import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
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

describe('App', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await login();
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

    expect(await screen.findByText('Profile')).toBeInTheDocument();

    expect(
      await screen.findByRole('tab', { name: 'Reviews 0' })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('tab', { name: 'Likes 0' })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('tab', { name: 'Subscriptions 0' })
    ).toBeInTheDocument();
  });

  it('subscribes from a course page and shows the subscription on the profile', async () => {
    const user = userEvent.setup();

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

    expect(
      await screen.findByRole('tab', { name: 'Subscriptions 1' })
    ).toBeInTheDocument();

    await user.click(
      await screen.findByRole('tab', { name: 'Subscriptions 1' })
    );

    expect(
      await screen.findByRole('link', { name: 'COMP 202' })
    ).toHaveAttribute('href', '/course/comp-202');
  });

  it('renders courses on the explore page', async () => {
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

  it('searches courses on the explore page', async () => {
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
    ).find((button) => button.offsetParent !== null);

    if (!leaveReview) {
      throw new Error('Leave a review button not found');
    }

    await user.click(leaveReview);

    const form = within(await screen.findByRole('dialog'));

    await user.type(
      form.getByRole('combobox', { name: 'Instructor(s)' }),
      'Jonathan'
    );

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

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

    expect(
      (await screen.findAllByText(content)).find(
        (element) => element.offsetParent !== null
      )
    ).toBeVisible();

    navigate('/profile');

    expect(await screen.findByText('Profile')).toBeInTheDocument();

    expect(
      await screen.findByRole('tab', { name: 'Reviews 1' })
    ).toBeInTheDocument();

    expect(await screen.findByText(content)).toBeInTheDocument();

    expect(
      await screen.findByRole('link', { name: 'COMP 202' })
    ).toHaveAttribute('href', '/course/comp-202');
  });
});
