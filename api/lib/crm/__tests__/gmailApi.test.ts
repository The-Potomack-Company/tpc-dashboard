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
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('returns body string', async () => {
    const { getThreadBody } = await import('../gmailApi');
    googleMocks.threadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            internalDate: String(Date.parse('2026-05-20T12:00:00.000Z')),
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
            internalDate: String(Date.parse('2026-05-20T12:00:00.000Z')),
            payload: { mimeType: 'text/plain', body: { data: encodeBody('First body') } },
          },
          {
            id: 'msg-2',
            threadId: 'thread-1',
            internalDate: String(Date.parse('2026-05-20T13:00:00.000Z')),
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
    const { getThreadBody, getThreadContent } = await import('../gmailApi');
    const emptyThreadResponse = {
      data: {
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            internalDate: String(Date.parse('2026-05-20T12:00:00.000Z')),
            payload: { mimeType: 'application/json', body: { data: encodeBody('{"not":"email"}') } },
          },
        ],
      },
    };
    googleMocks.threadsGet.mockResolvedValueOnce(emptyThreadResponse).mockResolvedValueOnce(emptyThreadResponse);

    await expect(getThreadBody('thread-1')).resolves.toBe('');
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('[crm-debug] empty body extracted', {
      threadId: 'thread-1',
      messageCount: 1,
      imageCount: 0,
    });

    vi.mocked(console.warn).mockClear();
    await expect(getThreadContent('thread-1')).resolves.toEqual({
      text: '',
      images: [],
      messages: [
        {
          messageId: 'msg-1',
          from: { name: '', email: '' },
          date: new Date('2026-05-20T12:00:00.000Z'),
          snippet: '',
          bodyText: '',
          hasAttachments: true,
          isForward: false,
        },
      ],
    });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('[crm-debug] empty body extracted', {
      threadId: 'thread-1',
      messageCount: 1,
      imageCount: 0,
    });
  });

  it('fetches image attachments with the source message id', async () => {
    const { getThreadContent } = await import('../gmailApi');
    googleMocks.threadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            internalDate: String(Date.parse('2026-05-20T12:00:00.000Z')),
            payload: {
              mimeType: 'multipart/mixed',
              parts: [
                {
                  mimeType: 'image/jpeg',
                  body: { attachmentId: 'att-1', size: 1000 },
                },
              ],
            },
          },
        ],
      },
    });
    googleMocks.attachmentsGet.mockResolvedValueOnce({
      data: { data: Buffer.from('image-bytes', 'utf8').toString('base64url') },
    });

    await expect(getThreadContent('thread-1')).resolves.toEqual({
      text: '',
      images: [{ mimeType: 'image/jpeg', data: Buffer.from('image-bytes', 'utf8').toString('base64url') }],
      messages: [
        {
          messageId: 'msg-1',
          from: { name: '', email: '' },
          date: new Date('2026-05-20T12:00:00.000Z'),
          snippet: '',
          bodyText: '',
          hasAttachments: true,
          isForward: false,
        },
      ],
    });

    expect(googleMocks.attachmentsGet).toHaveBeenCalledWith({
      userId: 'consign@example.com',
      messageId: 'msg-1',
      id: 'att-1',
    });
    expect(console.warn).not.toHaveBeenCalled();
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
            internalDate: String(Date.parse('2026-05-20T12:00:00.000Z')),
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
