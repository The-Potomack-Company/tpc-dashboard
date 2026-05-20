import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GmailVerbForbidden } from '../types';

const googleMocks = vi.hoisted(() => {
  const setCredentials = vi.fn();
  const oauth2 = vi.fn(function OAuth2() {
    return { setCredentials };
  });
  const list = vi.fn();
  const get = vi.fn();
  const gmail = vi.fn(() => ({
    users: {
      messages: {
        list,
        get,
      },
    },
  }));

  return { setCredentials, oauth2, list, get, gmail };
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

  it('returns concatenated body string', async () => {
    const { getThreadBody } = await import('../gmailApi');
    googleMocks.list.mockResolvedValueOnce({
      data: { messages: [{ id: 'msg-1' }, { id: 'msg-2' }] },
    });
    googleMocks.get
      .mockResolvedValueOnce({
        data: {
          id: 'msg-1',
          threadId: 'thread-1',
          payload: { mimeType: 'text/plain', body: { data: encodeBody('First body') } },
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'msg-2',
          threadId: 'thread-1',
          payload: {
            mimeType: 'multipart/alternative',
            parts: [{ mimeType: 'text/html', body: { data: encodeBody('<p>Second &amp; body</p>') } }],
          },
        },
      });

    await expect(getThreadBody('thread-1')).resolves.toBe('First body\n\nSecond & body');
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
    googleMocks.list.mockResolvedValueOnce({ data: { messages: [] } });

    await getThreadBody('thread-1');

    expect(googleMocks.setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-token' });
  });
});

function encodeBody(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
