import { google } from 'googleapis';
import { GmailVerbForbidden, type GmailImageAttachment, type GmailThreadContent } from './types.js';

const ALLOWED_VERBS = ['messages.list', 'messages.get', 'messages.attachments.get'] as const;
const MAX_IMAGES_PER_THREAD = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB cap per image (Gemini limit + cost guard)
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

type AllowedVerb = (typeof ALLOWED_VERBS)[number];

type GmailPayloadPart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null;
  parts?: GmailPayloadPart[] | null;
};

type GmailMessageResource = {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  payload?: GmailPayloadPart | null;
};

type GmailClient = ReturnType<typeof google.gmail>;

export function assertAllowedGmailVerb(verb: string): asserts verb is AllowedVerb {
  if (!ALLOWED_VERBS.includes(verb as AllowedVerb)) {
    throw new GmailVerbForbidden(verb);
  }
}

export async function getThreadContent(threadId: string): Promise<GmailThreadContent> {
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
  const images: GmailImageAttachment[] = [];

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

    if (images.length < MAX_IMAGES_PER_THREAD) {
      const imageRefs = collectImageRefs(message.payload).slice(0, MAX_IMAGES_PER_THREAD - images.length);
      const fetched = await Promise.all(
        imageRefs.map((ref) => fetchAttachment(gmail, userId, messageRef.id!, ref)),
      );
      for (const img of fetched) {
        if (img) images.push(img);
      }
    }
  }

  return { text: bodies.join('\n\n').trim(), images };
}

// Back-compat shim — older callers expect text-only.
export async function getThreadBody(threadId: string): Promise<string> {
  return (await getThreadContent(threadId)).text;
}

type ImageRef = { attachmentId: string; mimeType: string; size: number };

function collectImageRefs(payload: GmailPayloadPart | null | undefined): ImageRef[] {
  if (!payload) return [];
  const refs: ImageRef[] = [];
  const own = payload.mimeType ?? '';
  const attId = payload.body?.attachmentId ?? null;
  const size = payload.body?.size ?? 0;
  if (
    attId &&
    ALLOWED_IMAGE_MIMES.has(own) &&
    typeof size === 'number' &&
    size > 0 &&
    size <= MAX_IMAGE_BYTES
  ) {
    refs.push({ attachmentId: attId, mimeType: own, size });
  }
  for (const part of payload.parts ?? []) {
    refs.push(...collectImageRefs(part));
  }
  return refs;
}

async function fetchAttachment(
  gmail: GmailClient,
  userId: string,
  messageId: string,
  ref: ImageRef,
): Promise<GmailImageAttachment | null> {
  assertAllowedGmailVerb('messages.attachments.get');
  try {
    const response = await gmail.users.messages.attachments.get({
      userId,
      messageId,
      id: ref.attachmentId,
    });
    const urlSafe = response.data.data ?? '';
    if (!urlSafe) return null;
    // Gmail returns URL-safe base64; convert to standard base64 for Gemini.
    const standard = urlSafe.replace(/-/g, '+').replace(/_/g, '/');
    return { mimeType: ref.mimeType, data: standard };
  } catch (error) {
    console.error('[crm-debug] attachment fetch failed', ref.attachmentId, error instanceof Error ? error.message : error);
    return null;
  }
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
