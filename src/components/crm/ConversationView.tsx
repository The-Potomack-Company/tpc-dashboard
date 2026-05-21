import type { CrmMessage } from '../../lib/crm';

type ConversationViewProps = {
  raw: string | null;
  fallbackSnippet: string | null;
  messages?: CrmMessage[];
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function ConversationView({ messages }: ConversationViewProps) {
  if (!messages || messages.length === 0) {
    return (
      <article className="rounded-md border border-dashed border-rule bg-bg px-4 py-5 text-sm text-ink-3">
        No messages loaded
      </article>
    );
  }

  return (
    <article className="space-y-3 text-sm leading-6 text-ink-2">
      {messages.map((message) => (
        <MessageCard key={message.messageId || `${message.from.email}-${message.date}`} message={message} />
      ))}
    </article>
  );
}

function MessageCard({ message }: { message: CrmMessage }) {
  return (
    <section className="rounded-md border border-rule bg-bg p-3 shadow-sm">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-ink">{message.from.name || 'Unknown sender'}</span>
        {message.from.email && <span className="text-ink-3">&lt;{message.from.email}&gt;</span>}
        <span className="text-ink-4">-</span>
        <time className="text-ink-3" dateTime={message.date}>
          {formatDate(message.date)}
        </time>
        {message.hasAttachments && (
          <span className="rounded-full bg-bg-2 px-2 py-0.5 font-medium text-ink-2">
            Attachment
          </span>
        )}
        {message.isForward && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
            Forward
          </span>
        )}
      </header>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-ink-2">
        {message.bodyText || message.snippet || 'No body text available.'}
      </pre>
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? DATE_FORMAT.format(date) : value;
}

export default ConversationView;
