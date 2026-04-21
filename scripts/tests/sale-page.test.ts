import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseSalePage } from '../lib/parsers/sale-page.js';
import { SaleRecordSchema } from '../lib/schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadFixture = (name: string) =>
  readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');

describe('parseSalePage — IT254 canonical', () => {
  const text = loadFixture('sale-page-IT254.txt');
  const raw = parseSalePage(text, { sourcePdfPath: '/fake/IT254.PDF' });
  const parsed = SaleRecordSchema.parse(raw);

  it('extracts sale_number from header', () => {
    expect(parsed.sale_number).toBe('IT254');
  });

  it('extracts title', () => {
    expect(parsed.title).toBe('Estate of General Colin L. Powell');
  });

  it('extracts sale_date as ISO (YYYY-MM-DD)', () => {
    expect(parsed.sale_date).toBe('2022-11-16');
  });

  it('extracts lots_auctioned', () => {
    expect(parsed.lots_auctioned).toBe(428);
  });

  it('extracts lots_sold', () => {
    expect(parsed.lots_sold).toBe(424);
  });

  it('extracts hammer_total from tab-field Total Hammer Paid', () => {
    expect(parsed.hammer_total).toBe(407660.0);
  });

  it('extracts buyer_premium from tab-field Premium', () => {
    expect(parsed.buyer_premium).toBe(101915.0);
  });

  it('extracts seller_commission from tab-field Commission', () => {
    expect(parsed.seller_commission).toBe(65437.5);
  });

  it('extracts insurance', () => {
    expect(parsed.insurance).toBe(6134.85);
  });

  it('extracts lot_charges', () => {
    expect(parsed.lot_charges).toBe(10700.0);
  });

  it('extracts referral_fees (label with no trailing colon)', () => {
    expect(parsed.referral_fees).toBe(0);
  });

  it('extracts net_revenue', () => {
    expect(parsed.net_revenue).toBe(209866.51);
  });

  it('sets source_pdf_path from options', () => {
    expect(parsed.source_pdf_path).toBe('/fake/IT254.PDF');
  });

  it('defaults validation_warning to false', () => {
    expect(parsed.validation_warning).toBe(false);
  });
});

describe('parseSalePage — 11ES $.NULL. edge case', () => {
  const text = loadFixture('sale-page-11ES.txt');

  it('parses without throwing', () => {
    expect(() => {
      const raw = parseSalePage(text, { sourcePdfPath: '/fake/11ES.PDF' });
      SaleRecordSchema.parse(raw);
    }).not.toThrow();
  });

  it('returns null for at least one of hammer_total, buyer_premium, net_revenue', () => {
    const raw = parseSalePage(text, { sourcePdfPath: '/fake/11ES.PDF' });
    const parsed = SaleRecordSchema.parse(raw);
    const anyNull =
      parsed.hammer_total === null ||
      parsed.buyer_premium === null ||
      parsed.net_revenue === null;
    expect(anyNull).toBe(true);
  });

  it('extracts sale_number 11ES', () => {
    const raw = parseSalePage(text, { sourcePdfPath: '/fake/11ES.PDF' });
    const parsed = SaleRecordSchema.parse(raw);
    expect(parsed.sale_number).toBe('11ES');
  });
});
