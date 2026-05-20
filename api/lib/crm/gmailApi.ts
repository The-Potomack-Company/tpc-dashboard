import { google } from 'googleapis';
import { GmailVerbForbidden } from './types.js';

const ALLOWED_VERBS = ['messages.list', 'messages.get'] as const;

type AllowedVerb = (typeof ALLOWED_VERBS)[number];

type GmailPayloadPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPayloadPart[] | null;
};

type GmailMessageResource = {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  payload?: GmailPayloadPart | null;
};

export function assertAllowedGmailVerb(verb: string): asserts verb is AllowedVerb {
  if (!ALLOWED_VERBS.includes(verb as AllowedVerb)) {
    throw new GmailVerbForbidden(verb);
  }
}

export async function getThreadBody(threadId: string): Promise<string> {
  const userId = readRequiredEnv('GMAIL_USER_EMAIL');
  const oauth2Client = new google.auth.OAuth2(
    readRequiredEnv('GMAIL_OAUTH_CLIENT_ID'),
    readRequiredEnv('GMAIL_OAUTH_CLIENT_SECRET'),
  );
  oauth2Client.setCredentials({
    refresh_token: readRequiredEnv('GMAIL_REFRESH_TOKEN', 'GMAIL_OAUTH_REFRESH_TOKEN'),
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  assertAllowedGmailVerb('messages.list');
  const listResponse = await gmail.users.messages.list({
    userId,
    q: `thread:${threadId}`,
  });

  const messageRefs = listResponse.data.messages ?? [];
  const bodies: string[] = [];

  for (const messageRef of messageRefs) {
    if (!messageRef.id) {
      continue;
    }

    assertAllowedGmailVerb('messages.get');
    const messageResponse = await gmail.users.messages.get({
      userId,
      id: messageRef.id,
      format: 'full',
    });
    const message = messageResponse.data as GmailMessageResource;
    if (message.threadId && message.threadId !== threadId) {
      continue;
    }

    const body = extractBodyText(message.payload);
    if (body) {
      bodies.push(body);
    }
  }

  return bodies.join('\n\n').trim();
}

function extractBodyText(payload: GmailPayloadPart | null | undefined): string {
  const plain = collectMimeParts(payload, 'text/plain')
    .map(decodeBase64Url)
    .filter(Boolean);
  if (plain.length > 0) {
    return plain.join('\n').trim();
  }

  return collectMimeParts(payload, 'text/html')
    .map(decodeBase64Url)
    .map(stripHtml)
    .filter(Boolean)
    .join('\n')
    .trim();
}

function collectMimeParts(
  payload: GmailPayloadPart | null | undefined,
  mimeType: 'text/plain' | 'text/html',
): string[] {
  if (!payload) {
    return [];
  }

  const ownData = payload.mimeType === mimeType && payload.body?.data ? [payload.body.data] : [];
  const nestedData = (payload.parts ?? []).flatMap((part) => collectMimeParts(part, mimeType));
  return [...ownData, ...nestedData];
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8').trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function readRequiredEnv(key: string, fallbackKey?: string): string {
  const value = process.env[key] ?? (fallbackKey ? process.env[fallbackKey] : undefined);
  if (!value) {
    throw new Error(`Missing required env var: ${fallbackKey ? `${key} or ${fallbackKey}` : key}`);
  }

  return value;
}
