import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { MockInstance } from 'vitest';

import type { Review } from '../lib/types';
import { renderWithRouter } from '../testing/router-wrapper';
import { CourseReview, ReviewAttachment } from './course-review';

const toastPromiseMock = vi.hoisted(() =>
  vi.fn((promise: Promise<unknown>) => promise)
);
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-auth', () => ({
  useAuth: () => null,
}));

vi.mock('sonner', () => ({
  toast: {
    promise: toastPromiseMock,
    error: toastErrorMock,
    success: vi.fn(),
  },
}));

const baseReview: Review = {
  content: 'Short content',
  courseId: 'COMP202',
  difficulty: 3,
  instructors: ['Ada Lovelace'],
  likes: 5,
  rating: 4,
  timestamp: '1700000000000',
  userId: 'user-1',
};

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard'
);

let writeTextMock: MockInstance<(text: string) => Promise<void>>;

beforeAll(() => {
  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    writeTextMock = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockImplementation(() => Promise.resolve());
  } else {
    const mockFn = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve()
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mockFn,
      },
    });
    writeTextMock = mockFn;
  }
});

afterAll(() => {
  if ('mockRestore' in writeTextMock) {
    writeTextMock.mockRestore();
  }

  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
  } else if (
    !(
      navigator.clipboard && typeof navigator.clipboard.writeText === 'function'
    )
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).clipboard;
  }
});

afterEach(() => {
  writeTextMock.mockReset();
  toastPromiseMock.mockClear();
  toastErrorMock.mockClear();

  writeTextMock.mockImplementation(() => Promise.resolve());
});

describe('CourseReview', () => {
  it('applies anchor id to wrapper when provided', () => {
    const { container } = renderWithRouter(
      <CourseReview
        anchorId='desktop-review-anchor'
        canModify={false}
        handleDelete={vi.fn()}
        openEditReview={vi.fn()}
        review={baseReview}
      />
    );

    expect(
      container.querySelector('#desktop-review-anchor')
    ).toBeInTheDocument();
  });

  it('expands truncated content when "Show more" is clicked', async () => {
    const longContent = 'a'.repeat(350);

    renderWithRouter(
      <CourseReview
        canModify={false}
        handleDelete={vi.fn()}
        openEditReview={vi.fn()}
        review={{ ...baseReview, content: longContent }}
      />
    );

    expect(
      screen.getByRole('button', { name: /show more/i })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /show more/i }));

    expect(
      screen.queryByRole('button', { name: /show more/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(longContent)).toBeInTheDocument();
  });

  it('renders bold and italic formatting in content', () => {
    renderWithRouter(
      <CourseReview
        canModify={false}
        handleDelete={vi.fn()}
        openEditReview={vi.fn()}
        review={{
          ...baseReview,
          content: 'A *small* **test** of emphasis.',
        }}
      />
    );

    expect(screen.getByText('small').tagName).toBe('EM');
    expect(screen.getByText('test').tagName).toBe('STRONG');
  });

  it('renders scroll attachment when requested', () => {
    renderWithRouter(
      <CourseReview
        canModify={false}
        handleDelete={vi.fn()}
        openEditReview={vi.fn()}
        review={baseReview}
        attachment={ReviewAttachment.ScrollButton}
      />
    );

    expect(
      screen.getByRole('link', { name: /scroll to this review/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /copy review link/i,
      })
    ).not.toBeInTheDocument();
  });

  it('copies review link and shows success indicator when copy attachment is used', async () => {
    writeTextMock.mockResolvedValueOnce(undefined);

    renderWithRouter(
      <CourseReview
        canModify={false}
        handleDelete={vi.fn()}
        openEditReview={vi.fn()}
        review={baseReview}
        attachment={ReviewAttachment.CopyButton}
      />
    );

    const button = screen.getByRole('button', {
      name: /copy review link for comp202/i,
    });

    const icons = button.querySelectorAll('svg');
    const copyIconEl = icons.item(0);
    const checkIconEl = icons.item(1);

    expect(copyIconEl).not.toBeNull();
    expect(checkIconEl).not.toBeNull();

    expect(
      (copyIconEl as SVGSVGElement).classList.contains('opacity-100')
    ).toBe(true);
    expect((checkIconEl as SVGSVGElement).classList.contains('opacity-0')).toBe(
      true
    );

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(toastErrorMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(toastPromiseMock).toHaveBeenCalled();
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining(`review=${baseReview.userId}`)
    );

    const updatedButton = screen.getByRole('button', {
      name: /copy review link for comp202/i,
    });
    const updatedCopyIcon = updatedButton.querySelector('svg:nth-of-type(1)');
    const updatedCheckIcon = updatedButton.querySelector('svg:nth-of-type(2)');

    expect(updatedCopyIcon).not.toBeNull();
    expect(updatedCheckIcon).not.toBeNull();
    expect(
      (updatedCopyIcon as SVGSVGElement).classList.contains('opacity-0')
    ).toBe(true);
    expect(
      (updatedCheckIcon as SVGSVGElement).classList.contains('opacity-100')
    ).toBe(true);
  });
});
