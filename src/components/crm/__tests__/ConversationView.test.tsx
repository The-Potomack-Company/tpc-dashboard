import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConversationView } from '../ConversationView';

describe('ConversationView', () => {
  it('renders structured messages oldest first', () => {
    render(
      <ConversationView
        raw="Full stale painting body"
        fallbackSnippet={null}
        messages={[
          {
            messageId: 'msg-1',
            from: { name: 'Pat Smith', email: 'pat@example.com' },
            date: '2026-05-20T12:00:00.000Z',
            snippet: 'Full stale painting body',
            bodyText: 'Full stale painting body',
            hasAttachments: false,
            isForward: false,
          },
        ]}
      />,
    );

    expect(screen.getByText('Full stale painting body')).toBeInTheDocument();
    expect(screen.getByText('Pat Smith')).toBeInTheDocument();
    expect(screen.getByText('<pat@example.com>')).toBeInTheDocument();
  });

  it('shows attachment and forward indicators', () => {
    render(
      <ConversationView
        raw={null}
        fallbackSnippet={null}
        messages={[
          {
            messageId: 'msg-1',
            from: { name: 'Pat Smith', email: 'pat@example.com' },
            date: '2026-05-20T12:00:00.000Z',
            snippet: '',
            bodyText: 'Forwarded body',
            hasAttachments: true,
            isForward: true,
          },
        ]}
      />,
    );

    expect(screen.getByText('Attachment')).toBeInTheDocument();
    expect(screen.getByText('Forward')).toBeInTheDocument();
  });

  it('shows an empty state when structured messages are missing', () => {
    render(<ConversationView raw="Readable message." fallbackSnippet={null} />);

    expect(screen.getByText('No messages loaded')).toBeInTheDocument();
  });
});
