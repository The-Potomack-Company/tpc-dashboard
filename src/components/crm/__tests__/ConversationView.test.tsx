import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ConversationView } from '../ConversationView';

describe('ConversationView', () => {
  it('renders a single-message body unchanged', () => {
    render(<ConversationView raw="Full stale painting body" fallbackSnippet={null} />);

    expect(screen.getByText('Full stale painting body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show quoted text/i })).not.toBeInTheDocument();
  });

  it('reveals quoted text from the collapsed toggle', async () => {
    const user = userEvent.setup();
    render(
      <ConversationView
        raw={'Latest reply.\n\nOn May 20, 2026, Pat wrote:\n> Earlier reply.'}
        fallbackSnippet={null}
      />,
    );

    expect(screen.queryByText(/Earlier reply/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show quoted text' }));
    expect(screen.getByText(/Earlier reply/)).toBeInTheDocument();
  });

  it('shows the original toggle only for fallback content', () => {
    const { rerender } = render(<ConversationView raw="   " fallbackSnippet={null} />);

    expect(screen.getByRole('button', { name: 'Show original' })).toBeInTheDocument();

    rerender(<ConversationView raw="Readable message." fallbackSnippet={null} />);

    expect(screen.queryByRole('button', { name: 'Show original' })).not.toBeInTheDocument();
  });
});
