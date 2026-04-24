import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ValidationWarningBanner } from '../components/ValidationWarningBanner';

describe('ValidationWarningBanner', () => {
  it('renders role="status" container with polite live region (WR-02)', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ValidationWarningBanner saleNumber="22OCT" />
      </QueryClientProvider>,
    );
    // WR-02: role="status" (aria-live="polite") replaces role="alert"
    // so the banner doesn't re-interrupt on remount after Reload.
    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders locked copy from UI-SPEC', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ValidationWarningBanner saleNumber="22OCT" />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText(
        /Department totals don't match the sale totals for this sale\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /spot-check against the source PDF before relying on them\./,
      ),
    ).toBeInTheDocument();
  });

  it('renders a "Reload sale" button', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ValidationWarningBanner saleNumber="22OCT" />
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole('button', { name: /Reload sale/ }),
    ).toBeInTheDocument();
  });

  it('calls queryClient.invalidateQueries with the correct key on Reload click', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    render(
      <QueryClientProvider client={qc}>
        <ValidationWarningBanner saleNumber="22OCT" />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reload sale/ }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['sale', '22OCT'] });
  });

  it('propagates the saleNumber prop into the invalidation key', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    render(
      <QueryClientProvider client={qc}>
        <ValidationWarningBanner saleNumber="24JAN-FINE" />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reload sale/ }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['sale', '24JAN-FINE'] });
  });

  it('has amber surface classes', () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <ValidationWarningBanner saleNumber="22OCT" />
      </QueryClientProvider>,
    );
    const root = container.querySelector('[role="status"]');
    expect(root).toBeTruthy();
    const classes = root?.className ?? '';
    expect(classes).toMatch(/rounded-lg/);
    expect(classes).toMatch(/border/);
    expect(classes).toMatch(/amber-500\/50/);
    expect(classes).toMatch(/bg-amber-50/);
  });
});
