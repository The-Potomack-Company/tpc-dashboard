// Phase 6 Plan 06-04 — Tests for SaleSelectionFooter.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-04-PLAN.md § Task 3.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const navigateMock = vi.fn();
vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

import { SaleSelectionFooter } from './SaleSelectionFooter';

function renderFooter(
  selectedSaleNumbers: readonly string[],
  maxHint: string | null = null,
  onClear: () => void = () => {},
) {
  return render(
    <MemoryRouter>
      <SaleSelectionFooter
        selectedSaleNumbers={selectedSaleNumbers}
        onClear={onClear}
        maxHint={maxHint}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockClear();
});

describe('SaleSelectionFooter', () => {
  it('T1: renders null when selectedSaleNumbers is empty', () => {
    const { container } = renderFooter([]);
    expect(container.firstChild).toBeNull();
  });

  it('T2: size === 1 shows disabled Compare button with hint', () => {
    renderFooter(['2024-01']);
    const compareBtn = screen.getByRole('button', { name: /Compare \(1\)/ });
    expect(compareBtn).toBeDisabled();
    expect(compareBtn.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen.getByText('Select at least 2 sales to compare'),
    ).toBeInTheDocument();
  });

  it('T3: size === 2 Compare button is active with bg-accent class', () => {
    renderFooter(['2024-01', '2024-02']);
    const compareBtn = screen.getByRole('button', { name: /Compare \(2\)/ });
    expect(compareBtn).not.toBeDisabled();
    expect(compareBtn.className).toMatch(/bg-accent/);
  });

  it('T4: size === 4 renders Compare (4) active', () => {
    renderFooter(['A', 'B', 'C', 'D']);
    const compareBtn = screen.getByRole('button', { name: /Compare \(4\)/ });
    expect(compareBtn).not.toBeDisabled();
    expect(compareBtn.className).toMatch(/bg-accent/);
  });

  it('T5: clicking active Compare navigates with CSV sales param', () => {
    renderFooter(['2024-01', '2024-02', '2024-03']);
    const compareBtn = screen.getByRole('button', { name: /Compare \(3\)/ });
    fireEvent.click(compareBtn);
    expect(navigateMock).toHaveBeenCalledWith(
      '/sales/compare?sales=2024-01,2024-02,2024-03',
    );
  });

  it('T6: clicking Clear selection fires onClear', () => {
    const onClear = vi.fn();
    renderFooter(['2024-01', '2024-02'], null, onClear);
    const clearBtn = screen.getByRole('button', { name: /Clear selection/ });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('T7: maxHint non-null renders a role=status element with the hint text', () => {
    const { rerender } = renderFooter(
      ['2024-01', '2024-02', '2024-03', '2024-04'],
      'Max 4 sales — clear one to add a different sale',
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Max 4 sales');

    // Rerender with maxHint=null: status element should be gone
    rerender(
      <MemoryRouter>
        <SaleSelectionFooter
          selectedSaleNumbers={['2024-01', '2024-02', '2024-03', '2024-04']}
          onClear={() => {}}
          maxHint={null}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
