import { render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Histogram } from './histogram';

vi.mock('./ui/tooltip', () => ({
  Tooltip: ({
    children,
    className,
    text,
  }: {
    children: ReactNode;
    className?: string;
    text: string;
  }) => (
    <div data-testid='tooltip' data-text={text} className={className}>
      {children}
    </div>
  ),
}));

describe('Histogram', () => {
  const baseProps = {
    data: [1, 2, 2, 4],
    max: 5,
    width: 80,
    height: 100,
  };

  it('renders a bar for each value with matching labels and tooltip counts', () => {
    render(<Histogram {...baseProps} />);

    const tooltips = screen.getAllByTestId('tooltip');

    expect(tooltips).toHaveLength(baseProps.max);

    const expectedDistribution = baseProps.data.reduce((acc, value) => {
      acc[value - 1]++;
      return acc;
    }, Array(baseProps.max).fill(0));

    tooltips.forEach((tooltip, index) => {
      expect(tooltip).toHaveAttribute(
        'data-text',
        expectedDistribution[index].toString()
      );
      expect(tooltip).toHaveClass('whitespace-nowrap');

      const parent = tooltip.parentElement;

      expect(parent).not.toBeNull();

      expect(
        within(parent as HTMLElement).getByText(String(index + 1))
      ).toBeInTheDocument();
    });
  });

  it('sizes each bar based on the data distribution', async () => {
    render(<Histogram {...baseProps} />);

    const tooltips = screen.getAllByTestId('tooltip');

    const bars = tooltips.map((tooltip) =>
      tooltip.querySelector('div')
    ) as (HTMLDivElement | null)[];

    const expectedWidth = baseProps.width / baseProps.max - 4;

    const baseHeight = baseProps.height - 14;

    const expectedDistribution = baseProps.data.reduce((acc, value) => {
      acc[value - 1]++;
      return acc;
    }, Array(baseProps.max).fill(0));

    const expectedHeights = expectedDistribution.map(
      (count) => (count / baseProps.data.length) * baseHeight
    );

    bars.forEach((bar) => {
      expect(bar).not.toBeNull();
      expect(bar as HTMLDivElement).toHaveStyle({
        width: `${expectedWidth}px`,
        marginLeft: '2px',
        marginRight: '2px',
      });
    });

    await waitFor(() => {
      expectedHeights.forEach((height, index) => {
        const bar = bars[index];
        expect(bar).not.toBeNull();
        expect(bar as HTMLDivElement).toHaveStyle({
          height: `${height}px`,
        });
      });
    });
  });

  it('merges provided className with the default styles', () => {
    const { container } = render(
      <Histogram {...baseProps} className='text-blue-500' />
    );

    const root = container.firstChild;

    expect(root).toHaveClass('relative', 'w-fit', 'text-blue-500');
  });
});
