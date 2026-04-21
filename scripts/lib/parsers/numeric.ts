// Numeric parsers for RFC auction profile PDFs.
// All functions are pure: string input → typed output. Null on missing/unparseable.
// Source: verified edge cases from Sale IT254, 41, 119, 11ES (RESEARCH.md).

export function parseMoney(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // $.NULL. sentinel → null (observed in Sale 11ES)
  if (/^\$?\.NULL\.$/i.test(s)) return null;
  // $-1,931.40 → negative values (observed in Sale 41)
  const m = /^\$?(?<sign>-)?(?<digits>[\d,]+(?:\.\d{1,2})?)$/.exec(s);
  if (!m?.groups) return null;
  const n = parseFloat(m.groups.digits.replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  return m.groups.sign === '-' ? -n : n;
}

export function parseCount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/,/g, '');
  if (!s) return null;
  // Accept negative counts (Lots Not Paid can be -1 in 11ES).
  const m = /^(?<sign>-)?(?<digits>\d+)(?:\s+.*)?$/.exec(s);
  if (!m?.groups) return null;
  const n = parseInt(m.groups.digits, 10);
  if (Number.isNaN(n)) return null;
  return m.groups.sign === '-' ? -n : n;
}

export function parseMoneyRange(
  raw: string | null | undefined,
): { low: number | null; high: number | null } {
  if (raw === null || raw === undefined) return { low: null, high: null };
  const s = String(raw).trim();
  if (!s) return { low: null, high: null };
  // "$629,925-946,355" → {low: 629925, high: 946355}
  // "$30,000-0"        → {low: 30000, high: null}  (RFC sentinel for no upper bound)
  // "$0-0"             → {low: 0, high: 0}
  const m =
    /^\$?(?<low>[\d,]+(?:\.\d{1,2})?)\s*-\s*(?<high>[\d,]+(?:\.\d{1,2})?)$/.exec(s);
  if (!m?.groups) return { low: null, high: null };
  const low = parseFloat(m.groups.low.replace(/,/g, ''));
  const high = parseFloat(m.groups.high.replace(/,/g, ''));
  if (Number.isNaN(low) || Number.isNaN(high)) return { low: null, high: null };
  // Sentinel: "$30,000-0" means no upper bound (low > 0, high == 0).
  return { low, high: high < low && low > 0 ? null : high };
}

export function parseLotsSold(
  raw: string | null | undefined,
): { count: number | null; sellThroughPct: number | null } {
  if (raw === null || raw === undefined) return { count: null, sellThroughPct: null };
  const s = String(raw).trim();
  if (!s) return { count: null, sellThroughPct: null };
  // "424 (99% not incl. withdrawn)" → count 424, pct 99
  // "0"                              → count 0, pct null
  const m = /^(?<count>[\d,]+)(?:\s*\((?<pct>\d+(?:\.\d+)?)%\s*not\s*incl\.\s*withdrawn\))?/.exec(
    s,
  );
  if (!m?.groups) return { count: null, sellThroughPct: null };
  const count = parseInt(m.groups.count.replace(/,/g, ''), 10);
  if (Number.isNaN(count)) return { count: null, sellThroughPct: null };
  const sellThroughPct = m.groups.pct ? parseFloat(m.groups.pct) : null;
  return { count, sellThroughPct };
}

export function parseAuctionedLots(
  raw: string | null | undefined,
): { count: number | null; withdrawn?: number } {
  if (raw === null || raw === undefined) return { count: null };
  const s = String(raw).trim();
  if (!s) return { count: null };
  // "33 (1 Withdrawn)" → count 33, withdrawn 1
  // "428"              → count 428
  const m = /^(?<count>[\d,]+)(?:\s+\((?<withdrawn>\d+)\s+Withdrawn\))?$/.exec(s);
  if (!m?.groups) return { count: null };
  const count = parseInt(m.groups.count.replace(/,/g, ''), 10);
  if (Number.isNaN(count)) return { count: null };
  return m.groups.withdrawn
    ? { count, withdrawn: parseInt(m.groups.withdrawn, 10) }
    : { count };
}
