import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  kpiSummarySchema,
  type KpiSummary,
  type KpiWindow,
} from '../lib/kpi-schema';

// Phase 4 Plan 02 Task 3 — Zod schema contract locked by
// .planning/phases/04-kpi-landing-page/04-RESEARCH.md § Pattern 4 and
// § Pitfall 1 (why Zod, not `as`). The RPC return type is `Json`; Zod is the
// trust boundary between PostgREST response and typed client code.

const validPayload = {
  current: {
    revenue: 1_234_567.89,
    sell_through: 0.684,
    lots_sold: 14239,
    sales_count: 12,
  },
  previous: {
    revenue: 1_000_000,
    sell_through: 0.65,
    lots_sold: 10000,
    sales_count: 10,
  },
};

describe('kpiSummarySchema — happy path', () => {
  it('parses a valid payload and yields number-typed numeric fields', () => {
    const parsed = kpiSummarySchema.parse(validPayload);
    expect(parsed.current.revenue).toBe(1_234_567.89);
    expect(typeof parsed.current.revenue).toBe('number');
    expect(parsed.current.sell_through).toBe(0.684);
    expect(parsed.current.lots_sold).toBe(14239);
    expect(parsed.current.sales_count).toBe(12);
    expect(parsed.previous.revenue).toBe(1_000_000);
    expect(parsed.previous.sales_count).toBe(10);
  });

  it('accepts null sell_through (NULLIF divide-by-zero path) on either window', () => {
    const raw = {
      current: { ...validPayload.current, sell_through: null },
      previous: { ...validPayload.previous, sell_through: null },
    };
    const parsed = kpiSummarySchema.parse(raw);
    expect(parsed.current.sell_through).toBeNull();
    expect(parsed.previous.sell_through).toBeNull();
    // Non-nullable fields still parse as numbers.
    expect(parsed.current.revenue).toBe(1_234_567.89);
  });

  it('accepts numeric-as-string for precision-preserving numeric(14,2) values', () => {
    const raw = {
      ...validPayload,
      current: {
        ...validPayload.current,
        revenue: '9999999999999.99',
      },
    };
    const parsed = kpiSummarySchema.parse(raw);
    expect(typeof parsed.current.revenue).toBe('number');
    expect(parsed.current.revenue).toBe(9999999999999.99);
  });

  it('accepts integer-as-string on count fields', () => {
    const raw = {
      ...validPayload,
      previous: { ...validPayload.previous, sales_count: '10' },
    };
    const parsed = kpiSummarySchema.parse(raw);
    expect(parsed.previous.sales_count).toBe(10);
    expect(typeof parsed.previous.sales_count).toBe('number');
  });
});

describe('kpiSummarySchema — rejection cases', () => {
  it('rejects missing window fields with a ZodError', () => {
    expect(() =>
      kpiSummarySchema.parse({ current: { revenue: 100 } }),
    ).toThrow();
  });

  it('rejects a null root', () => {
    expect(() => kpiSummarySchema.parse(null)).toThrow();
  });

  it('rejects a non-finite numeric string ("bogus")', () => {
    const raw = {
      ...validPayload,
      current: { ...validPayload.current, revenue: 'bogus' },
    };
    expect(() => kpiSummarySchema.parse(raw)).toThrow();
  });

  it('rejects the literal string "null" for a numeric field (distinct from JSON null)', () => {
    const raw = {
      ...validPayload,
      current: { ...validPayload.current, sell_through: 'null' as unknown },
    };
    expect(() => kpiSummarySchema.parse(raw)).toThrow();
  });

  it('rejects a boolean for a numeric field (numericLike is strict)', () => {
    const raw = {
      ...validPayload,
      current: { ...validPayload.current, lots_sold: true as unknown },
    };
    expect(() => kpiSummarySchema.parse(raw)).toThrow();
  });

  it('rejects a missing previous window entirely', () => {
    const raw = { current: validPayload.current };
    expect(() => kpiSummarySchema.parse(raw)).toThrow();
  });
});

describe('kpiSummarySchema — type narrowing (INFR-04 Json → KpiSummary)', () => {
  it('KpiSummary.current.revenue is typed number (no Json bleed-through)', () => {
    expectTypeOf<KpiSummary['current']['revenue']>().toEqualTypeOf<number>();
    expectTypeOf<KpiSummary['current']['sell_through']>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<KpiSummary['current']['lots_sold']>().toEqualTypeOf<number>();
    expectTypeOf<KpiSummary['current']['sales_count']>().toEqualTypeOf<number>();
  });

  it('KpiWindow matches the current/previous window shape', () => {
    expectTypeOf<KpiSummary['current']>().toEqualTypeOf<KpiWindow>();
    expectTypeOf<KpiSummary['previous']>().toEqualTypeOf<KpiWindow>();
  });
});
