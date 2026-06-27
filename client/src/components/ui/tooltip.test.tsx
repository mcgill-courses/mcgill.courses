import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Tooltip } from './tooltip';

describe('Tooltip', () => {
  it('shows tooltip text on hover and preserves child event handlers', async () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();

    render(
      <Tooltip text='bar'>
        <button onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
          foo
        </button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'foo' });

    await userEvent.hover(trigger);

    expect(await screen.findByText('bar')).toBeInTheDocument();
    expect(onMouseEnter).toHaveBeenCalledOnce();

    await userEvent.unhover(trigger);

    expect(onMouseLeave).toHaveBeenCalledOnce();
  });
});
