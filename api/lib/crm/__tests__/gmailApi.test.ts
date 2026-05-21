import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GmailVerbForbidden } from '../types';

const googleMocks = vi.hoisted(() => {
  const setCredentials = vi.fn();
  const oauth2 = vi.fn(function OAuth2() {
    return { setCredentials };
  });
  const threadsGet = vi.fn();
  const attachmentsGet = vi.fn();
  const gmail = vi.fn(() => ({
    users: {
      threads: {
        get: threadsGet,
      },
      messages: {
        attachments: {
          get: attachmentsGet,
        },
      },
    },
  }));

  return { setCredentials, oauth2, threadsGet, attachmentsGet, gmail };
});

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: googleMocks.oauth2,
    },
    gmail: googleMocks.gmail,
  },
}));

const OLD_ENV = process.env;

describe('getThreadBody', () => {
  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      GMAIL_OAUTH_CLIENT_ID: 'client-id',
      GMAIL_OAUTH_CLIENT_SECRET: 'client-secret',
      GMAIL_OAUTH_REFRESH_TOKEN: 'refresh-token',
      GMAIL_USER_EMAIL: 'consign@example.com',
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns body string', async () => {
    const { getThreadBody } = await import('../gmailApi');
    googleMocks.threadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            payload: { mimeType: 'text/plain', body: { data: encodeBody('First body') } },
          },
        ],
      },
    });

    await expect(getThreadBody('thread-1')).resolves.toBe('First body');
  });

  it('returns concatenated bodies for a multi-message thread', async () => {
    const { getThreadBody } = await import('../gmailApi');
    googleMocks.threadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            payload: { mimeType: 'text/plain', body: { data: encodeBody('First body') } },
          },
          {
            id: 'msg-2',
            threadId: 'thread-1',
            payload: {
              mimeType: 'multipart/alternative',
              parts: [{ mimeType: 'text/html', body: { data: encodeBody('<p>Second &amp; body</p>') } }],
            },
          },
        ],
      },
    });

    await expect(getThreadBody('thread-1')).resolves.toBe('First body\n\nSecond & body');
  });

  it('warns when thread body extraction returns empty text', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { getThreadBody } = await import('../gmailApi');
    googleMocks.threadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            payload: { mimeType: 'application/json', body: { data: encodeBody('{"not":"email"}') } },
          },
        ],
      },
    });

    await expect(getThreadBody('thread-1')).resolves.toBe('');

    expect(warn).toHaveBeenCalledWith('[crm-poll] empty body extracted', {
      threadId: 'thread-1',
      messageCount: 1,
    });
    warn.mockRestore();
  });

  it('throws GmailVerbForbidden for disallowed message modification verb', async () => {
    const { assertAllowedGmailVerb } = await import('../gmailApi');

    expect(() => assertAllowedGmailVerb('messages.modify')).toThrow(GmailVerbForbidden);
  });

  it('throws GmailVerbForbidden for disallowed message sending verb', async () => {
    const { assertAllowedGmailVerb } = await import('../gmailApi');

    expect(() => assertAllowedGmailVerb('messages.send')).toThrow(GmailVerbForbidden);
  });

  it('throws GmailVerbForbidden for disallowed thread modification verb', async () => {
    const { assertAllowedGmailVerb } = await import('../gmailApi');

    expect(() => assertAllowedGmailVerb('threads.modify')).toThrow(GmailVerbForbidden);
  });

  it('sets OAuth refresh token credentials', async () => {
    const { getThreadBody } = await import('../gmailApi');
    googleMocks.threadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            payload: { mimeType: 'text/plain', body: { data: encodeBody('Credential check') } },
          },
        ],
      },
    });

    await getThreadBody('thread-1');

    expect(googleMocks.setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-token' });
  });
});

function encodeBody(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
