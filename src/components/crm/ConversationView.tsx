import { Fragment, useMemo, useState } from 'react';
import { parseConversation, type ParsedMessage, type ParsedSegment } from '../../lib/crm-text';

type ConversationViewProps = {
  raw: string | null;
  fallbackSnippet: string | null;
};

export function ConversationView({ raw, fallbackSnippet }: ConversationViewProps) {
  const source = raw || fallbackSnippet || '';
  const parsed = useMemo(() => parseConversation(source), [source, source.length]);
  const [showOriginal, setShowOriginal] = useState(false);

  if (parsed.isFallback) {
    return (
      <article className="text-sm leading-6 text-ink-2">
        <pre className="whitespace-pre-wrap font-sans">
          {fallbackSnippet || raw || 'No body text available.'}
        </pre>
        <button
          type="button"
          className="mt-3 text-xs font-medium text-accent hover:underline"
          onClick={() => setShowOriginal((current) => !current)}
        >
          {showOriginal ? 'Hide original' : 'Show original'}
        </button>
        {showOriginal && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-bg p-3 font-sans text-xs text-ink-2">
            {parsed.raw || 'No body text available.'}
          </pre>
        )}
      </article>
    );
  }

  return (
    <article className="text-sm leading-6 text-ink-2">
      {parsed.messages.map((message, index) => (
        <Fragment key={message.id}>
          {index > 0 && <hr className="my-3 border-bg-3" />}
          <MessageSection message={message} />
        </Fragment>
      ))}
    </article>
  );
}

function MessageSection({ message }: { message: ParsedMessage }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  return (
    <section>
      {message.body.map((segment, index) => (
        <Fragment key={`${segment.kind}-${index}`}>
          {renderSegment({
            segment,
            showQuoted,
            showSignature,
            onToggleQuoted: () => setShowQuoted((current) => !current),
            onToggleSignature: () => setShowSignature((current) => !current),
          })}
        </Fragment>
      ))}
    </section>
  );
}

function renderSegment({
  segment,
  showQuoted,
  showSignature,
  onToggleQuoted,
  onToggleSignature,
}: {
  segment: ParsedSegment;
  showQuoted: boolean;
  showSignature: boolean;
  onToggleQuoted: () => void;
  onToggleSignature: () => void;
}) {
  if (segment.kind === 'text') {
    return <span className="whitespace-pre-wrap">{segment.value}</span>;
  }

  if (segment.kind === 'link') {
    return (
      <a
        className="text-accent hover:underline"
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {segment.label}
      </a>
    );
  }

  if (segment.kind === 'quoted') {
    return (
      <div className="mt-3">
        <button
          type="button"
          className="text-xs font-medium text-accent hover:underline"
          onClick={onToggleQuoted}
        >
          {showQuoted ? 'Hide quoted text' : 'Show quoted text'}
        </button>
        {showQuoted && (
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-bg p-3 font-sans text-xs text-ink-3">
            {segment.raw}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        className="text-xs font-medium text-accent hover:underline"
        onClick={onToggleSignature}
      >
        {showSignature ? 'Hide signature' : 'Show signature'}
      </button>
      {showSignature && (
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-bg p-3 font-sans text-xs text-ink-3">
          {segment.raw}
        </pre>
      )}
    </div>
  );
}

export default ConversationView;
