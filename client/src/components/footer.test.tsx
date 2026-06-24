import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithRouter } from '../testing/router-wrapper';
import { Footer } from './footer';

describe('Footer', () => {
  it('places changelog after about', () => {
    renderWithRouter(<Footer />);

    expect(
      screen
        .getAllByRole('link')
        .slice(0, 6)
        .map((link) => link.textContent)
    ).toEqual([
      'Home',
      'About',
      'Changelog',
      'Explore',
      'Reviews',
      'Schedule Builder',
    ]);

    expect(screen.getByRole('link', { name: 'Changelog' })).toHaveAttribute(
      'href',
      '/changelog'
    );
  });
});
