import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, createContext, useContext } from 'react';
import { vi } from 'vitest';

import { Select } from './select';

vi.mock('lucide-react', () => ({
  ChevronDown: (props: Record<string, unknown>) => (
    <svg data-testid='chevron-icon' {...props} />
  ),
}));

vi.mock('@headlessui/react', () => {
  const ListboxContext = createContext<{
    value: unknown;
    onChange: (value: unknown) => void;
  }>({
    value: undefined,
    onChange: () => {},
  });

  const ListboxRoot = ({
    children,
    value,
    onChange,
  }: {
    children: ReactNode;
    value: unknown;
    onChange: (value: unknown) => void;
  }) => (
    <ListboxContext.Provider value={{ value, onChange }}>
      <div>{children}</div>
    </ListboxContext.Provider>
  );

  const ListboxButton = ({ children, ...rest }: { children: ReactNode }) => (
    <button type='button' {...rest}>
      {children}
    </button>
  );

  const ListboxOptions = ({ children, ...rest }: { children: ReactNode }) => (
    <div role='listbox' {...rest}>
      {children}
    </div>
  );

  const ListboxOption = ({
    value,
    className,
    children,
    ...rest
  }: {
    value: unknown;
    className?: string | ((args: { active: boolean }) => string);
    children:
      | ReactNode
      | ((args: {
          selected: boolean;
          active: boolean;
          disabled: boolean;
        }) => ReactNode);
  }) => {
    const { value: selectedValue, onChange } = useContext(ListboxContext);
    const selected = selectedValue === value;

    const resolvedClassName =
      typeof className === 'function'
        ? className({ active: false })
        : className;

    const content =
      typeof children === 'function'
        ? children({ selected, active: false, disabled: false })
        : children;

    return (
      <div
        aria-selected={selected}
        role='option'
        {...rest}
        className={resolvedClassName}
        onClick={() => onChange(value)}
      >
        {content}
      </div>
    );
  };

  return {
    Listbox: Object.assign(ListboxRoot, {
      Button: ListboxButton,
      Options: ListboxOptions,
      Option: ListboxOption,
    }),
    Transition: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

describe('Select', () => {
  const options = ['foo', 'bar', 'baz'] as const;

  it('renders the current value and options', () => {
    render(<Select options={options} setValue={vi.fn()} value='bar' />);

    expect(screen.getByRole('button', { name: 'bar' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(options.length);
    expect(screen.getByRole('option', { name: 'foo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'bar' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', { name: 'baz' })).toBeInTheDocument();
  });

  it('calls setValue when an option is selected', async () => {
    const setValue = vi.fn();
    const user = userEvent.setup();

    render(<Select options={options} setValue={setValue} value='foo' />);

    await user.click(screen.getByRole('option', { name: 'baz' }));

    expect(setValue).toHaveBeenCalledWith('baz');
  });
});
