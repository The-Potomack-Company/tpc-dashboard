import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterInput } from '../components/FilterInput';

describe('FilterInput', () => {
  it('fires onChange per keystroke', async () => {
    const onChange = vi.fn();
    render(
      <FilterInput
        value=""
        onChange={onChange}
        ariaLabel="Filter"
        placeholder="Search"
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Filter'), 'a');
    // Controlled input with unchanged value means each keystroke fires onChange
    // with the typed character. We assert the contract: onChange was called
    // with the new character at least once.
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('clears value on Escape', () => {
    const onChange = vi.fn();
    render(
      <FilterInput
        value="hello"
        onChange={onChange}
        ariaLabel="Filter"
        placeholder="Search"
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('Filter'), { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('renders clear button when value is non-empty', () => {
    const { rerender } = render(
      <FilterInput
        value=""
        onChange={() => {}}
        ariaLabel="Filter"
        placeholder="Search"
      />,
    );
    expect(screen.queryByLabelText('Clear filter')).toBeNull();
    rerender(
      <FilterInput
        value="abc"
        onChange={() => {}}
        ariaLabel="Filter"
        placeholder="Search"
      />,
    );
    expect(screen.getByLabelText('Clear filter')).toBeInTheDocument();
  });

  it('clears via clear button click', () => {
    const onChange = vi.fn();
    render(
      <FilterInput
        value="abc"
        onChange={onChange}
        ariaLabel="Filter"
        placeholder="Search"
      />,
    );
    fireEvent.click(screen.getByLabelText('Clear filter'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('applies focus ring classes to input', () => {
    render(
      <FilterInput
        value=""
        onChange={() => {}}
        ariaLabel="Filter"
        placeholder="Search"
      />,
    );
    const input = screen.getByLabelText('Filter');
    const cls = input.getAttribute('class') ?? '';
    // Phase 7 unified-design: focus ring + accent border-color now ship via
    // the `.tpc-input` base class (3px accent-wash box-shadow on :focus). We
    // assert the class itself rather than the individual Tailwind utilities.
    expect(cls).toContain('tpc-input');
  });
});
