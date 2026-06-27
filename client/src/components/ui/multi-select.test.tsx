import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type ChangeEvent,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  createContext,
  useContext,
  useState,
} from 'react';
import { vi } from 'vitest';

import { MultiSelect } from './multi-select';

vi.mock('lucide-react', () => ({
  Check: (props: Record<string, unknown>) => (
    <svg data-icon='check' {...props} />
  ),
  ChevronDown: (props: Record<string, unknown>) => (
    <svg data-icon='chevron-down' {...props} />
  ),
  X: (props: Record<string, unknown>) => <svg data-icon='x' {...props} />,
}));

vi.mock('@headlessui/react', () => {
  type ComboboxContextValue = {
    value: unknown;
    onChange: (value: unknown) => void;
    multiple?: boolean;
  };

  const ComboboxContext = createContext<ComboboxContextValue>({
    value: undefined,
    onChange: () => {},
    multiple: false,
  });

  const ComboboxRoot = ({
    children,
    value,
    onChange,
    multiple,
  }: {
    children: ReactNode;
    value: unknown;
    onChange: (value: unknown) => void;
    multiple?: boolean;
  }) => (
    <ComboboxContext.Provider value={{ value, onChange, multiple }}>
      <div>{children}</div>
    </ComboboxContext.Provider>
  );

  const ComboboxInput = ({
    onChange,
    onBlur,
    ...rest
  }: {
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  }) => (
    <input
      role='combobox'
      {...rest}
      onChange={(event) => onChange?.(event)}
      onBlur={(event) => onBlur?.(event)}
    />
  );

  const ComboboxButton = ({ children, ...rest }: { children: ReactNode }) => (
    <button type='button' {...rest}>
      {children}
    </button>
  );

  const ComboboxOptions = ({ children, ...rest }: { children: ReactNode }) => (
    <div role='listbox' {...rest}>
      {children}
    </div>
  );

  const ComboboxOption = ({
    value,
    className,
    children,
    onMouseDown,
    onMouseUp,
    ...rest
  }: {
    value: unknown;
    className?:
      | string
      | ((args: { active: boolean; selected: boolean }) => string);
    children:
      | ReactNode
      | ((args: {
          active: boolean;
          selected: boolean;
          disabled: boolean;
        }) => ReactNode);
    onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void;
    onMouseUp?: (event: MouseEvent<HTMLDivElement>) => void;
  }) => {
    const {
      value: selectedValue,
      onChange,
      multiple,
    } = useContext(ComboboxContext);

    const isSelected = Array.isArray(selectedValue)
      ? selectedValue.includes(value)
      : selectedValue === value;

    const resolvedClassName =
      typeof className === 'function'
        ? className({ active: false, selected: isSelected })
        : className;

    const content =
      typeof children === 'function'
        ? children({ active: false, selected: isSelected, disabled: false })
        : children;

    return (
      <div
        role='option'
        aria-selected={isSelected}
        {...rest}
        className={resolvedClassName}
        onMouseDown={(event) => onMouseDown?.(event)}
        onMouseUp={(event) => onMouseUp?.(event)}
        onClick={() => {
          if (multiple) {
            const current = Array.isArray(selectedValue) ? selectedValue : [];
            const exists = current.includes(value);
            const next = exists
              ? current.filter((item) => item !== value)
              : [...current, value];
            onChange(next);
          } else {
            onChange(value);
          }
        }}
      >
        {content}
      </div>
    );
  };

  return {
    Combobox: Object.assign(ComboboxRoot, {
      Input: ComboboxInput,
      Button: ComboboxButton,
      Options: ComboboxOptions,
      Option: ComboboxOption,
    }),
    Transition: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

describe('MultiSelect', () => {
  const options = ['Alpha', 'Beta', 'Gamma', 'Delta'];

  const TestHarness = ({
    initialValues = [],
    onValuesChange = () => {},
  }: {
    initialValues?: string[];
    onValuesChange?: (values: string[]) => void;
  }) => {
    const [values, setValues] = useState<string[]>(initialValues);

    const handleChange = (next: string[]) => {
      setValues(next);
      onValuesChange(next);
    };

    return (
      <MultiSelect
        options={options}
        values={values}
        setValues={handleChange}
        className='test-wrapper'
      />
    );
  };

  it('filters options when typing into the input', async () => {
    render(<TestHarness />);

    const user = userEvent.setup();
    const input = screen.getByRole('combobox');

    await user.type(input, 'ga');

    const listbox = screen.getByRole('listbox');

    expect(
      within(listbox).getByRole('option', { name: 'Gamma' })
    ).toBeInTheDocument();

    expect(within(listbox).queryByRole('option', { name: 'Alpha' })).toBeNull();

    expect(within(listbox).queryByRole('option', { name: 'Beta' })).toBeNull();

    expect(within(listbox).queryByRole('option', { name: 'Delta' })).toBeNull();
  });

  it('allows selecting multiple options and renders chips', async () => {
    const { container } = render(<TestHarness />);

    const user = userEvent.setup();

    await user.click(screen.getByRole('option', { name: 'Alpha' }));
    await user.click(screen.getByRole('option', { name: 'Beta' }));

    const selectedContainer = container.querySelector('.test-wrapper .mt-2');

    expect(selectedContainer?.textContent).toContain('Alpha');
    expect(selectedContainer?.textContent).toContain('Beta');
  });

  it('removes a selected option when the remove button is clicked', async () => {
    const { container } = render(
      <TestHarness initialValues={['Alpha', 'Beta']} />
    );

    const user = userEvent.setup();

    const selectedContainer = container.querySelector('.test-wrapper .mt-2');
    const removeButtons = selectedContainer?.querySelectorAll('button');

    await user.click(removeButtons?.[0] as HTMLButtonElement);

    await waitFor(() => {
      const updatedContainer = container.querySelector('.test-wrapper .mt-2');
      expect(updatedContainer?.textContent).not.toContain('Alpha');
      expect(updatedContainer?.textContent).toContain('Beta');
    });
  });

  it('restores all options after blur when no option is clicked', async () => {
    render(<TestHarness />);

    const user = userEvent.setup();
    const input = screen.getByRole('combobox');
    const listbox = screen.getByRole('listbox');

    await user.type(input, 'ga');

    expect(
      within(listbox).getByRole('option', { name: 'Gamma' })
    ).toBeInTheDocument();

    expect(within(listbox).queryByRole('option', { name: 'Alpha' })).toBeNull();

    input.blur();

    await waitFor(() => {
      expect(
        within(listbox).getByRole('option', { name: 'Alpha' })
      ).toBeInTheDocument();

      expect(
        within(listbox).getByRole('option', { name: 'Gamma' })
      ).toBeInTheDocument();
    });
  });
});
