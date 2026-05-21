import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriorityChip } from '../PriorityChip';

describe('PriorityChip', () => {
  it('maps HIGH to error tokens', () => {
    render(<PriorityChip priority="high" />);
    expect(screen.getByText('high')).toHaveClass('bg-err-wash', 'text-err');
  });

  it('maps STANDARD to neutral tokens', () => {
    render(<PriorityChip priority="standard" />);
    expect(screen.getByText('standard')).toHaveClass('bg-bg-3', 'text-ink');
  });

  it('maps LOW to success tokens', () => {
    render(<PriorityChip priority="low" />);
    expect(screen.getByText('low')).toHaveClass('bg-ok-wash', 'text-ok');
  });
});
