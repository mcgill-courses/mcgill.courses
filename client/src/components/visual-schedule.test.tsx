import { render, screen } from '@testing-library/react';

import type { BuilderBlock } from '../lib/schedule-builder';
import { VisualSchedule } from './visual-schedule';

const block = (
  courseId: string,
  display: string,
  t1: string,
  t2: string
): BuilderBlock => ({
  campus: 'foo',
  courseId,
  courseTitle: 'foo',
  crn: display,
  display,
  location: 'foo',
  timeblocks: [{ day: '2', t1, t2 }],
});

describe('VisualSchedule', () => {
  it('renders overlapping meetings in separate lanes', () => {
    render(
      <VisualSchedule
        blocks={[
          block('FOO', 'foo', '540', '600'),
          block('BAR', 'bar', '570', '630'),
        ]}
        onBlockClick={() => {}}
      />
    );

    const foo = screen.getByRole('button', { name: 'Pin FOO foo' });
    const bar = screen.getByRole('button', { name: 'Pin BAR bar' });

    expect(foo.style.left).toBe('0.25rem');
    expect(foo.style.width).toBe('calc(50% - 0.5rem)');
    expect(bar.style.left).toBe('calc(50% + 0.25rem)');
    expect(bar.style.width).toBe('calc(50% - 0.5rem)');
  });

  it('keeps adjacent meetings full width', () => {
    render(
      <VisualSchedule
        blocks={[
          block('FOO', 'foo', '540', '600'),
          block('BAR', 'bar', '600', '660'),
        ]}
        onBlockClick={() => {}}
      />
    );

    const foo = screen.getByRole('button', { name: 'Pin FOO foo' });
    const bar = screen.getByRole('button', { name: 'Pin BAR bar' });

    expect(foo.style.left).toBe('0.25rem');
    expect(foo.style.width).toBe('calc(100% - 0.5rem)');
    expect(bar.style.left).toBe('0.25rem');
    expect(bar.style.width).toBe('calc(100% - 0.5rem)');
  });
});
