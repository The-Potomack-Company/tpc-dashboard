import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import type { Priority, TriageRow } from '../../services/crm/types';
import { ConversationView } from './ConversationView';

type ExpandedRowProps = {
  row: TriageRow;
};

type ImageAttachment = {
  mimeType: string;
  data: string;
};

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

function formatClassifiedAgo(value: string | null): string {
  if (!value) return 'unknown time';

  const diffMs = new Date(value).getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  if (absMs < 60_000) return RELATIVE_FORMAT.format(Math.round(diffMs / 1_000), 'second');
  if (absMs < 3_600_000) return RELATIVE_FORMAT.format(Math.round(diffMs / 60_000), 'minute');
  if (absMs < 86_400_000) return RELATIVE_FORMAT.format(Math.round(diffMs / 3_600_000), 'hour');
  return RELATIVE_FORMAT.format(Math.round(diffMs / 86_400_000), 'day');
}

function ageRule(priority: Priority, effectivePriority: Priority): number | null {
  if (priority === 'standard' && effectivePriority === 'high') return 10;
  if (priority === 'low' && effectivePriority === 'high') return 30;
  if (priority === 'low' && effectivePriority === 'standard') return 14;
  return null;
}

function ageBumpExplanation(row: TriageRow): string | null {
  if (row.effective_priority === row.priority) return null;

  const ruleDays = ageRule(row.priority, row.effective_priority);
  if (ruleDays === null) return null;

  return `Bumped from ${row.priority} → ${row.effective_priority} after ${Math.round(
    row.age_days,
  )} days (${ruleDays}-day rule).`;
}

function normalizeAttachments(payload: unknown): ImageAttachment[] {
  // /api/gmail-attachment returns { images: [...] }. Also accepts a bare
  // array or { attachments: [...] } defensively so the UI doesn't lock
  // to a single envelope shape during demo iteration.
  const rawAttachments = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { images?: unknown }).images)
      ? (payload as { images: unknown[] }).images
      : payload && typeof payload === 'object' && Array.isArray((payload as { attachments?: unknown }).attachments)
        ? (payload as { attachments: unknown[] }).attachments
        : [];

  return rawAttachments.filter((attachment): attachment is ImageAttachment => {
    if (!attachment || typeof attachment !== 'object') return false;
    const value = attachment as { mimeType?: unknown; data?: unknown };
    return (
      typeof value.mimeType === 'string' &&
      value.mimeType.startsWith('image/') &&
      typeof value.data === 'string' &&
      value.data.length > 0 &&
      // Defense-in-depth: validate base64 before embedding into a data: URI.
      // Gmail's API returns well-formed base64 today, but anything that lands
      // outside that contract (proxy injection, content-encoding flip, etc.)
      // should never reach an <img src>.
      BASE64_RE.test(value.data)
    );
  });
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

async function fetchAttachments(threadId: string, accessToken: string): Promise<ImageAttachment[]> {
  const response = await fetch(`/api/gmail-attachment?threadId=${encodeURIComponent(threadId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Attachment fetch failed with HTTP ${response.status}`);
  }

  return normalizeAttachments(await response.json());
}

export function ExpandedRow({ row }: ExpandedRowProps) {
  const accessToken = useAuthStore((s) => s.session?.access_token);
  const attachmentsQuery = useQuery({
    queryKey: ['crm', 'attachments', row.gmail_thread_id] as const,
    queryFn: () => fetchAttachments(row.gmail_thread_id ?? '', accessToken ?? ''),
    enabled: !!row.gmail_thread_id && !!accessToken,
    retry: 0,
  });
  const bumpExplanation = ageBumpExplanation(row);

  return (
    <div className="grid gap-4 border-t border-rule bg-bg-2 px-4 py-4 md:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase text-ink-3">Body</h2>
        <ConversationView raw={row.body_text} fallbackSnippet={row.snippet} messages={row.messages} />
        {row.gmail_thread_id && (
          <div className="mt-4">
            {attachmentsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink-3">
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-accent" />
                <span>Loading attachments…</span>
              </div>
            ) : attachmentsQuery.error ? (
              <div className="rounded-md bg-err-wash px-3 py-2 text-sm text-err">
                Could not load attachments
              </div>
            ) : attachmentsQuery.data && attachmentsQuery.data.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {attachmentsQuery.data.map((attachment, index) => (
                  <img
                    key={`${attachment.mimeType}-${index}`}
                    src={`data:${attachment.mimeType};base64,${attachment.data}`}
                    className="max-h-56 rounded border border-rule object-contain"
                    loading="lazy"
                    alt="Email attachment"
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase text-ink-3">Full rationale</h2>
        <p className="text-sm leading-6 text-ink-2">{row.rationale ?? 'No rationale available.'}</p>
        <div className="mt-4 text-xs text-ink-3">
          {/* TODO: Replace hardcoded prompt version when TriageRow exposes prompt_version. */}
          {row.model ?? 'unknown model'} · v0.5.2 · classified {formatClassifiedAgo(row.classified_at)}
        </div>
        {bumpExplanation && <div className="mt-3 text-sm text-ink-2">{bumpExplanation}</div>}
        {row.gmail_thread_id && (
          <a
            href={`https://mail.google.com/mail/u/0/#inbox/${row.gmail_thread_id}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-sm text-accent underline"
          >
            Open thread in Gmail ↗
          </a>
        )}
      </div>
    </div>
  );
}
