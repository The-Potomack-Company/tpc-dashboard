// Department page (page 2..N) parser.
// Layout per fixture (IT254 FRN):
//   Lines 1-2 : repeated sale header + title
//   Line  3   : "Total Revenue:" (label only)
//   Line  4   : "Revenue Projection *" (heading)
//   Lines 5-N : left-column label block → value block
//   Inline "Total Reserve: $0.00" etc.
//   Tab-separated Premium / Commission / Insurance / Lot Charges
//   Standalone total line (e.g., "$14,078.96" = sum of the four above)
//   Dept header line, e.g., "FRN Furniture (General)"
//   "* Revenue Projection ..." footnote
//   Date + "Page N of M" footer

import type { SaleDepartmentRecord } from '../schemas.js';
import { parseMoney, parseMoneyRange, parseLotsSold, parseAuctionedLots } from './numeric.js';

const TAB_FIELD_RE = /^(?<value>[^\t]+)\t(?<label>.+?):?$/;
const INLINE_FIELD_RE = /^(?<label>[^:]+?):\s+(?<value>\S.*)$/;
const DEPT_HEADER_RE = /^(?<code>[A-Z][A-Z0-9]{1,5})\s+(?<name>.+)$/;
const DATE_FOOTER_RE = /^\d{2}\/\d{2}\/\d{4}\s+.*Page\s+\d+\s+of\s+\d+$/;
const PARENTHETICAL_RE = /^\(.*\)$/;

export function parseDepartmentPage(
  pageText: string,
): Omit<SaleDepartmentRecord, never> {
  const lines = pageText
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 0);

  // Locate department header by walking backwards, skipping footnote + date footer.
  let codeLine: string | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (!l) continue;
    if (l.startsWith('*')) continue;
    if (DATE_FOOTER_RE.test(l)) continue;
    // Skip standalone money lines (e.g., "$14,078.96" total).
    if (/^\$-?[\d,]+(?:\.\d{1,2})?$/.test(l)) continue;
    codeLine = l;
    break;
  }
  const deptM = codeLine ? DEPT_HEADER_RE.exec(codeLine) : null;
  const code = deptM?.groups?.code?.trim() ?? '';
  const displayName = (deptM?.groups?.name ?? '').trim();
  const display_name = displayName || code || 'Unknown';

  // Extract tab + inline fields.
  const tabFields: Record<string, string> = {};
  const inlineFields: Record<string, string> = {};
  for (const line of lines) {
    const tabM = TAB_FIELD_RE.exec(line);
    if (tabM?.groups) {
      tabFields[tabM.groups.label.trim()] = tabM.groups.value.trim();
      continue;
    }
    const inlineM = INLINE_FIELD_RE.exec(line);
    if (inlineM?.groups) {
      inlineFields[inlineM.groups.label.trim()] = inlineM.groups.value.trim();
    }
  }

  // Left-column cluster on dept pages: labels 1-7 (Total Estimate → Total Unsold Value),
  // values follow positionally. Values observed on FRN:
  //   [0] lots_auctioned       "38"
  //   [1] lots_sold            "37 (97% not incl. withdrawn)"
  //   [2] total_sold_value     "$30,685.00"
  //   [3] total_unsold_value   "$0.00"
  //   [4] "(100% by value, ...)"  — OPTIONAL parenthetical
  //   [5] total_estimate range "$8,795-14,050"
  //   [6] total_estimate_sold  "$8,745-13,950"
  //   [7] lots_below
  //   [8] lots_within
  //   [9] lots_above
  let firstLabelIdx = -1;
  let lastLabelIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === 'Total Estimate:') {
      firstLabelIdx = i;
      lastLabelIdx = i;
      while (lastLabelIdx + 1 < lines.length) {
        const next = lines[lastLabelIdx + 1].trim();
        if (!next.endsWith(':')) break;
        if (next.includes('\t')) break;
        if (next.includes(' ') && !/^[A-Z][a-z]/.test(next)) break;
        lastLabelIdx += 1;
      }
      break;
    }
  }

  const rawValues: string[] = [];
  if (firstLabelIdx >= 0) {
    for (let i = lastLabelIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (t.includes('\t')) break;
      // Stop on "Label: Value" inline pairs ("Total Reserve of Lots Sold: $0.00").
      if (/^[A-Z][^:]*:\s+\S/.test(t)) break;
      // Stop on standalone ":"-terminated labels.
      if (t.endsWith(':')) break;
      rawValues.push(t);
      if (rawValues.length >= 10) break;
    }
  }

  const hasParenthetical =
    rawValues.length >= 5 && PARENTHETICAL_RE.test(rawValues[4]);
  const pick = (posWithParen: number): string => {
    const idx = hasParenthetical
      ? posWithParen
      : posWithParen > 4
      ? posWithParen - 1
      : posWithParen;
    return rawValues[idx] ?? '';
  };

  const auctioned = parseAuctionedLots(pick(0));
  const sold = parseLotsSold(pick(1));
  const totalSoldValue = parseMoney(pick(2));
  const totalEstimate = parseMoneyRange(pick(5));

  // Reserves: inline field "Total Reserve: $0.00" (not "Total Reserve of Lots Sold").
  const reserves = parseMoney(inlineFields['Total Reserve']);

  // Revenue formula (RESOLVED Open Question #1 — verified against FRN $14,078.96):
  //   revenue = Premium + Commission + Insurance + Lot Charges
  // Sum treating nulls as 0 only when ALL four components are null
  // (then revenue is null). Otherwise include present values and skip nulls.
  const premium = parseMoney(tabFields['Premium']);
  const commission = parseMoney(tabFields['Commission']);
  const insurance = parseMoney(tabFields['Insurance']);
  const lotCharges = parseMoney(tabFields['Lot Charges']);
  const revenueParts = [premium, commission, insurance, lotCharges];
  const presentParts = revenueParts.filter((v): v is number => v !== null);
  const revenue =
    presentParts.length === 0 ? null : presentParts.reduce((s, v) => s + v, 0);
  // Round to 2 decimals to avoid floating-point drift (e.g., 14078.959999...).
  const revenueRounded = revenue === null ? null : Math.round(revenue * 100) / 100;

  return {
    code,
    display_name,
    lots_auctioned: auctioned.count,
    lots_sold: sold.count,
    sell_through_pct: sold.sellThroughPct,
    total_sold_value: totalSoldValue,
    low_estimate: totalEstimate.low,
    high_estimate: totalEstimate.high,
    reserves,
    revenue: revenueRounded,
  };
}
