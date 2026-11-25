import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { api } from '../lib/api';
import AuthProvider from './auth-provider';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({
  api: {
    getUser: vi.fn(),
  },
}));

it('renders children when fetching the user fails', async () => {
  vi.mocked(api.getUser).mockRejectedValue(new Error('foo'));

  render(<AuthProvider>bar</AuthProvider>);

  expect(await screen.findByText('bar')).toBeInTheDocument();
});
