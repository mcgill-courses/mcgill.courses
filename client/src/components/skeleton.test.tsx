import { render } from '@testing-library/react';

import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders a single skeleton by default', () => {
    const { container } = render(<Skeleton />);

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);
  });

  it('renders multiple skeletons when count is specified', () => {
    const { container } = render(<Skeleton count={5} />);

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5);
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className='mb-2 rounded-lg' />);

    expect(container.querySelector('.animate-pulse')).toHaveClass(
      'rounded-lg',
      'mb-2'
    );
  });

  it('applies width and height styles', () => {
    const { container } = render(<Skeleton width={200} height={100} />);

    expect(container.querySelector('.animate-pulse')).toHaveStyle({
      width: '200px',
      height: '100px',
    });
  });
});
