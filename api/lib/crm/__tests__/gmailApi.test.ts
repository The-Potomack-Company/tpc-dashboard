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

describe('stripReplyChain', () => {
  it('single-message-no-chain', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `Hello Albert,

Thank you for reaching out. We will review the items and follow up shortly.`;

    expect(stripReplyChain(input)).toBe(input);
  });

  it('gmail-intro-singleline', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `Thanks, we can take a look.

On Tue, May 19, 2026 at 2:23 PM Foo <foo@x.com> wrote:
> quoted
> stuff`;

    expect(stripReplyChain(input)).toBe('Thanks, we can take a look.');
  });

  it('gmail-intro-wrapped', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `Sincerely,
The Potomack Company

1120 North Fairfax St.

ᐧ

On Tue, May 19, 2026 at 2:23 PM Invaluable Private Label <
admin@invaluable.com> wrote:

> Name: Albert Missirlian
> Email: alm@example.com`;

    expect(stripReplyChain(input)).toBe(`Sincerely,
The Potomack Company

1120 North Fairfax St.`);
  });

  it('apple-mail-intro', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `I will send photos this afternoon.

On May 19, 2026, at 3:40 PM, Jane <jane@x.com> wrote:
> Can you send photos?`;

    expect(stripReplyChain(input)).toBe('I will send photos this afternoon.');
  });

  it('outlook-header-block', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `Please see my response above.

From: Jane Smith <jane@x.com>
Sent: Tuesday, May 19, 2026 3:40 PM
To: Consign <consign@example.com>
Subject: Re: Appraisal

Earlier message text`;

    expect(stripReplyChain(input)).toBe('Please see my response above.');
  });

  it('forwarded-banner', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `Forwarding this for your review.

---------- Forwarded message ---------
From: Jane Smith <jane@x.com>
Date: Tue, May 19, 2026 at 3:40 PM`;

    expect(stripReplyChain(input)).toBe('Forwarding this for your review.');
  });

  it('gmail-separator-only', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `This is the new reply.

ᐧ

On Tue, May 19, 2026 at 2:23 PM Foo <foo@x.com> wrote:
> quoted chain`;

    expect(stripReplyChain(input)).toBe('This is the new reply.');
  });

  it('single-quote-inline', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `I agree with this line:
> quoted phrase
That is the relevant part.`;

    expect(stripReplyChain(input)).toBe(input);
  });

  it('signature-preserved', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `We can include this in the next sale.

Sincerely,
The Potomack Company

NOTE: This e-mail is confidential and intended only for the recipient.`;

    expect(stripReplyChain(input)).toBe(input);
  });

  it('empty-after-strip', async () => {
    const { stripReplyChain } = await import('../gmailApi');
    const input = `On Tue, May 19, 2026 at 2:23 PM Foo <foo@x.com> wrote:
> quoted
> stuff`;

    expect(stripReplyChain(input)).toBe('');
  });
});

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

  it('extractMessages returns trimmed bodyText while keeping raw text', async () => {
    const { getThreadContent } = await import('../gmailApi');
    const rawBody = `Current sender content.

On Tue, May 19, 2026 at 2:23 PM Foo <foo@x.com> wrote:
> quoted
> stuff`;
    googleMocks.threadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            snippet: 'Current sender content.',
            internalDate: String(Date.parse('2026-05-20T12:00:00.000Z')),
            payload: {
              mimeType: 'text/plain',
              headers: [
                { name: 'From', value: 'Consign <consign@example.com>' },
                { name: 'Subject', value: 'Re: Appraisal' },
              ],
              body: { data: encodeBody(rawBody) },
            },
          },
        ],
      },
    });

    await expect(getThreadContent('thread-1')).resolves.toEqual({
      text: rawBody,
      images: [],
      messages: [
        {
          messageId: 'msg-1',
          from: { name: 'Consign', email: 'consign@example.com' },
          date: new Date('2026-05-20T12:00:00.000Z'),
          snippet: 'Current sender content.',
          bodyText: 'Current sender content.',
          hasAttachments: false,
          isForward: false,
        },
      ],
    });
  });
});

function encodeBody(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
