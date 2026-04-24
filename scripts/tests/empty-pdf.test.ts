import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parsePdf } from '../lib/parse-pdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => resolve(__dirname, 'fixtures', name);

describe('parsePdf — empty placeholder handling', () => {
  it('returns { status: "empty" } for 1182-byte empty placeholder', async () => {
    const result = await parsePdf(fixture('empty-pdf.bin'));
    expect(result.status).toBe('empty');
  });

  it('does not throw on empty placeholder', async () => {
    await expect(parsePdf(fixture('empty-pdf.bin'))).resolves.toBeDefined();
  });

  it('does not return status "failed" on empty placeholder', async () => {
    const result = await parsePdf(fixture('empty-pdf.bin'));
    expect(result.status).not.toBe('failed');
  });

  it('result has no sale/departments for empty placeholder', async () => {
    const result = await parsePdf(fixture('empty-pdf.bin'));
    if (result.status === 'empty') {
      // discriminated union — empty variant has no sale/departments keys
      expect('sale' in result).toBe(false);
      expect('departments' in result).toBe(false);
    }
  });

  it('returns { status: "failed" } on non-existent file (no throw)', async () => {
    const result = await parsePdf(fixture('does-not-exist.pdf'));
    expect(result.status).toBe('failed');
  });
});
