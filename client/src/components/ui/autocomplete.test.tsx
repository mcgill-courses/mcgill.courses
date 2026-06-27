import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, createContext, useContext } from 'react';
import { vi } from 'vitest';

import { Autocomplete } from './autocomplete';

vi.mock('lucide-react', () => ({
  ChevronDown: (props: Record<string, unknown>) => (
    <svg data-testid='chevron-icon' {...props} />
  ),
}));

vi.mock('@headlessui/react', () => {
  const ComboboxContext = createContext<{ onChange: (value: unknown) => void }>(
    {
      onChange: () => {},
    }
  );

  const Combobox = (({
    children,
    onChange,
  }: {
    children: ReactNode;
    onChange: (value: unknown) => void;
  }) => (
    <ComboboxContext.Provider value={{ onChange }}>
      <div>{children}</div>
    </ComboboxContext.Provider>
  )) as any;

  Combobox.Input = ({ onChange, ...rest }: any) => (
    <input role='textbox' {...rest} onChange={onChange} />
  );

  Combobox.Button = ({ children, ...rest }: any) => (
    <button type='button' {...rest}>
      {children}
    </button>
  );

  Combobox.Options = ({ children, ...rest }: any) => (
    <div role='listbox' {...rest}>
      {children}
    </div>
  );

  Combobox.Option = ({ value, className, children, ...rest }: any) => {
    const { onChange } = useContext(ComboboxContext);

    const content =
      typeof children === 'function'
        ? children({ active: false, selected: false, disabled: false })
        : children;

    const resolvedClassName =
      typeof className === 'function'
        ? className({ active: false })
        : className;

    return (
      <div
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
    Combobox,
    Transition: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

describe('Autocomplete', () => {
  const options = ['COMP 202', 'COMP 250', 'MATH 240'] as const;

  it('renders all provided options by default', () => {
    render(<Autocomplete options={options} setValue={vi.fn()} />);

    const renderedOptions = screen.getAllByRole('option');

    expect(renderedOptions).toHaveLength(options.length);

    options.forEach((option) => {
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument();
    });
  });

  it('filters options based on the query', async () => {
    render(<Autocomplete options={options} setValue={vi.fn()} />);

    const user = userEvent.setup();
    const input = screen.getByRole('textbox');

    await user.type(input, 'math');

    expect(
      await screen.findByRole('option', { name: 'MATH 240' })
    ).toBeVisible();
    expect(screen.queryByRole('option', { name: 'COMP 202' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'COMP 250' })).toBeNull();
  });

  it('calls setValue when an option is selected', async () => {
    const setValue = vi.fn();

    render(<Autocomplete options={options} setValue={setValue} />);

    const user = userEvent.setup();
    const targetOption = screen.getByRole('option', { name: 'COMP 250' });

    await user.click(targetOption);

    expect(setValue).toHaveBeenCalledWith('COMP 250');
  });
});
