import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SortIndicator } from '../components/SortIndicator';

describe('SortIndicator', () => {
  it('renders inactive chevron when state is false', () => {
    const { container } = render(<SortIndicator state={false} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const cls = svg?.getAttribute('class') ?? '';
    expect(cls).toContain('text-gray-400');
    expect(cls).toContain('w-4');
    expect(cls).toContain('h-4');
  });

  it('renders ascending chevron when state is "asc"', () => {
    const { container } = render(<SortIndicator state="asc" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class') ?? '').toContain('text-accent');
  });

  it('renders descending chevron when state is "desc"', () => {
    const { container } = render(<SortIndicator state="desc" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class') ?? '').toContain('text-accent');
  });

  it('renders different path markup for asc vs desc', () => {
    const { container: ascC } = render(<SortIndicator state="asc" />);
    const { container: descC } = render(<SortIndicator state="desc" />);
    const ascD = ascC.querySelector('path')?.getAttribute('d');
    const descD = descC.querySelector('path')?.getAttribute('d');
    expect(ascD).toBeTruthy();
    expect(descD).toBeTruthy();
    expect(ascD).not.toEqual(descD);
  });
});
