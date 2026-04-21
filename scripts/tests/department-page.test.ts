import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseDepartmentPage } from '../lib/parsers/department-page.js';
import { SaleDepartmentRecordSchema } from '../lib/schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadFixture = (name: string) =>
  readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');

describe('parseDepartmentPage — IT254 FRN canonical', () => {
  const text = loadFixture('department-page-IT254-FRN.txt');
  const raw = parseDepartmentPage(text);
  const parsed = SaleDepartmentRecordSchema.parse(raw);

  it('extracts department code from footer', () => {
    expect(parsed.code).toBe('FRN');
  });

  it('extracts display_name (non-empty)', () => {
    expect(parsed.display_name.length).toBeGreaterThan(0);
    expect(parsed.display_name).toBe('Furniture (General)');
  });

  it('extracts lots_auctioned as a positive integer', () => {
    expect(parsed.lots_auctioned).toBe(38);
    expect(Number.isInteger(parsed.lots_auctioned)).toBe(true);
  });

  it('extracts lots_sold', () => {
    expect(parsed.lots_sold).toBe(37);
  });

  it('extracts sell_through_pct', () => {
    expect(parsed.sell_through_pct).toBe(97);
  });

  it('extracts total_sold_value', () => {
    expect(parsed.total_sold_value).toBe(30685.0);
  });

  it('extracts low_estimate and high_estimate', () => {
    expect(parsed.low_estimate).toBe(8795);
    expect(parsed.high_estimate).toBe(14050);
  });

  // Plan-checker Warning #6: assert revenue formula matches the canonical
  // $14,078.96 value printed on the FRN fixture line (sum of Premium +
  // Commission + Insurance + Lot Charges).
  it('computes revenue as sum of Premium + Commission + Insurance + Lot Charges', () => {
    expect(parsed.revenue).toBe(14078.96);
  });
});
