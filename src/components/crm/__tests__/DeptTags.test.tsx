import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeptTags } from '../DeptTags';

describe('DeptTags', () => {
  it('renders multiple department tags', () => {
    render(<DeptTags departments={['furniture', 'decarts', 'art_sculpture']} />);

    expect(screen.getByText('furniture')).toBeInTheDocument();
    expect(screen.getByText('decarts')).toBeInTheDocument();
    expect(screen.getByText('art_sculpture')).toBeInTheDocument();
  });

  it('renders an empty-array fallback', () => {
    render(<DeptTags departments={[]} />);

    expect(screen.getByText('None')).toBeInTheDocument();
  });
});
