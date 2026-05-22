import type { CrmMessage } from './types';

type RawMessage = {
  messageId?: unknown;
  from?: unknown;
  date?: unknown;
  snippet?: unknown;
  bodyText?: unknown;
  hasAttachments?: unknown;
  isForward?: unknown;
};

export function parseMessages(raw: unknown): CrmMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map(toCrmMessage)
    .filter((message): message is CrmMessage => message !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function toCrmMessage(raw: unknown): CrmMessage | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as RawMessage;
  const date = normalizeDate(value.date);
  if (!date) {
    return null;
  }

  return {
    messageId: toString(value.messageId),
    from: normalizeFrom(value.from),
    date,
    snippet: toString(value.snippet),
    bodyText: toString(value.bodyText),
    hasAttachments: value.hasAttachments === true,
    isForward: value.isForward === true,
  };
}

function normalizeFrom(raw: unknown): CrmMessage['from'] {
  if (!raw || typeof raw !== 'object') {
    return { name: '', email: '' };
  }

  const from = raw as { name?: unknown; email?: unknown };
  return {
    name: toString(from.name),
    email: toString(from.email),
  };
}

function normalizeDate(raw: unknown): string | null {
  const date = raw instanceof Date ? raw : new Date(typeof raw === 'string' || typeof raw === 'number' ? raw : NaN);
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}

function toString(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}
