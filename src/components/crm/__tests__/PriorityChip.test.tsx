import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriorityChip } from '../PriorityChip';

describe('PriorityChip', () => {
  it('maps HIGH to red with white text', () => {
    render(<PriorityChip priority="high" />);
    expect(screen.getByText('high')).toHaveClass('bg-red-500', 'text-white');
  });

  it('maps STANDARD to yellow with black text', () => {
    render(<PriorityChip priority="standard" />);
    expect(screen.getByText('standard')).toHaveClass('bg-yellow-500', 'text-black');
  });

  it('maps LOW to green with white text', () => {
    render(<PriorityChip priority="low" />);
    expect(screen.getByText('low')).toHaveClass('bg-green-500', 'text-white');
  });
});
