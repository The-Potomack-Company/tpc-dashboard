import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConversation } from '../parseConversation';

function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), 'src/lib/crm-text/__tests__/fixtures', name),
    'utf8',
  );
}

function textFor(kind: 'quoted' | 'signature', raw: string) {
  return parseConversation(raw).messages.flatMap((message) =>
    message.body.filter((segment) => segment.kind === kind),
  );
}

describe('parseConversation', () => {
  it('keeps a plain single-message reply readable', () => {
    const parsed = parseConversation(fixture('single-message.txt'));

    expect(parsed.isFallback).toBe(false);
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].hasQuoted).toBe(false);
    expect(parsed.messages[0].hasSignature).toBe(false);
    expect(parsed.messages[0].body).toContainEqual(
      expect.objectContaining({
        kind: 'text',
        value: expect.stringContaining('Thanks for reaching out'),
      }),
    );
  });

  it('separates a reply from a quoted chain', () => {
    const parsed = parseConversation(fixture('two-reply-with-quote.txt'));

    expect(parsed.isFallback).toBe(false);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[1].hasQuoted).toBe(true);
  });

  it('captures an RFC signature delimiter', () => {
    const signatures = textFor('signature', fixture('signature-dashdash.txt'));

    expect(signatures).toHaveLength(1);
    expect(signatures[0]).toMatchObject({
      kind: 'signature',
      raw: expect.stringContaining('Jane Example'),
    });
  });

  it('captures a mobile trailer', () => {
    const signatures = textFor('signature', fixture('mobile-trailer.txt'));

    expect(signatures).toHaveLength(1);
    expect(signatures[0]).toMatchObject({
      kind: 'signature',
      raw: 'Sent from my iPhone',
    });
  });

  it('deduplicates repeated footer footprints after the first message', () => {
    const parsed = parseConversation(fixture('repeated-footer.txt'));

    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[1].hasSignature).toBe(true);
    expect(parsed.messages[2].hasSignature).toBe(true);
  });

  it('falls back for empty or whitespace-only input', () => {
    const parsed = parseConversation(fixture('garbage.txt'));

    expect(parsed.isFallback).toBe(true);
  });
});
