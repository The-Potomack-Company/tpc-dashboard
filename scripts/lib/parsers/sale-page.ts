// Sale page (page 1 "All Departments") parser.
// Strategy: extract values from three overlapping PDF layouts:
//   Pattern 1: VALUE<TAB>LABEL right-column (monetary fields)
//   Pattern 2: INLINE "Label: Value" (paid-invoice counts, reserves)
//   Pattern 3: positional left-column cluster (lot counts, estimates, buyers/sellers)
// Source: RESEARCH.md + empirical reading of IT254 + 11ES fixtures.

import type { SaleRecord } from '../schemas.js';
import {
  parseMoney,
  parseMoneyRange,
  parseLotsSold,
  parseAuctionedLots,
  parseCount,
} from './numeric.js';

const TAB_FIELD_RE = /^(?<value>[^\t]+)\t(?<label>.+?):?$/;
const INLINE_FIELD_RE = /^(?<label>[^:]+?):\s+(?<value>\S.*)$/;
const HEADER_RE =
  /^Auction Profile for Sale\s+(?<sale>\S+),\s+(?<date>[A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s*$/;
const PARENTHETICAL_CONTINUATION_RE = /^\(.*\)$/; // e.g., "(100% by value, incl. unsold value)"
const RANGE_LIKE_RE = /^\$?[\d,]+(?:\.\d{1,2})?-[\d,]+(?:\.\d{1,2})?$/;
const MONEY_LIKE_RE = /^\$(?:-)?[\d,]+(?:\.\d{1,2})?$/;
const LOTS_SOLD_VALUE_RE = /^[\d,]+\s*\(\d+(?:\.\d+)?%\s*not\s*incl\.\s*withdrawn\)/;

/**
 * The left-column value cluster has a FIXED positional ordering on the
 * sale page, regardless of what labels appear in the label block above it.
 * Derived by reading IT254 + 11ES side-by-side:
 *
 *   [0] Auctioned Lots               e.g. "428"            "1"
 *   [1] Lots Sold                    e.g. "424 (99% ...)"  "0 (0% ...)"
 *   [2] Total Sold Value             e.g. "$407,660.00"    "$0.00"
 *   [3] Total Unsold Value           e.g. "$850.00"        "$30,000.00"
 *   [4] "(100% by value, ...)"       — OPTIONAL parenthetical (only when sold>0)
 *   [5] Total Estimate               range
 *   [6] Total Estimate of Lots Sold  range
 *   [7] Lots Sold Below Estimate     integer
 *   [8] Lots Sold Within Estimate    integer  (NOTE: within-before-above)
 *   [9] Lots Sold Above Estimate     integer
 *   [10] Number Of Sellers (Receipts) e.g. "1 (1 Receipts)"
 *   [11] Number of Buyers            integer
 *   [12] Registered Bidders          integer
 *
 * The parenthetical at [4] is absent when total_sold_value==0.
 */

interface LeftColumnValues {
  auctionedLotsRaw: string;
  lotsSoldRaw: string;
  totalSoldValueRaw: string;
  totalUnsoldValueRaw: string;
  totalEstimateRaw: string;
  lotsSoldBelowRaw: string;
  lotsSoldWithinRaw: string;
  lotsSoldAboveRaw: string;
  numberOfSellersRaw: string;
  numberOfBuyersRaw: string;
  registeredBiddersRaw: string;
}

function extractLeftColumnValues(lines: string[]): LeftColumnValues {
  // Locate the left-column value cluster: the first line that begins with a
  // digit and is preceded by a contiguous block of ":"-ending labels.
  let firstLabelIdx = -1;
  let lastLabelIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === 'Total Estimate:') {
      firstLabelIdx = i;
      lastLabelIdx = i;
      // scan forward for contiguous "X:" labels (no tab, no inline value)
      while (lastLabelIdx + 1 < lines.length) {
        const next = lines[lastLabelIdx + 1].trim();
        // Stop at a line that's not a pure label (contains tab, or has a value after colon)
        if (!next.endsWith(':') || next.includes('\t')) break;
        // Inline-with-value like "Total Reserve of Lots Sold: $0.00" would end ":"? No — ends with value.
        lastLabelIdx += 1;
      }
      break;
    }
  }
  if (firstLabelIdx < 0) {
    return emptyLeftCol();
  }
  // Values start immediately after the last label, in order, with the
  // OPTIONAL parenthetical at position 4 when present.
  const valStart = lastLabelIdx + 1;
  const rawValues: string[] = [];
  for (let i = valStart; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    // Stop when we hit the next structural element (inline label, tab field, or date/header).
    if (t.includes('\t')) break;
    // Inline "Label: Value" lines (like "Total Reserve of Lots Sold: $0.00") end the cluster.
    if (/^[A-Z][^:]*:\s+\S/.test(t)) break;
    // Bare-label lines ending with ":" also end the cluster (next section).
    if (t.endsWith(':') && !t.includes(' ')) break;
    // Accept numeric, money, range, or parenthetical continuation.
    rawValues.push(t);
    if (rawValues.length >= 13) break;
  }

  // Decide whether the parenthetical at position 4 is present.
  // Heuristic: if rawValues[4] matches /^\(.*\)$/ → parenthetical present;
  // otherwise collapse indices (no parenthetical).
  const hasParenthetical =
    rawValues.length >= 5 && PARENTHETICAL_CONTINUATION_RE.test(rawValues[4]);

  const pick = (posWithParen: number): string => {
    // posWithParen is the index when parenthetical is present.
    // If no parenthetical, shift any index > 4 down by 1.
    const idx = hasParenthetical ? posWithParen : posWithParen > 4 ? posWithParen - 1 : posWithParen;
    return rawValues[idx] ?? '';
  };

  return {
    auctionedLotsRaw: pick(0),
    lotsSoldRaw: pick(1),
    totalSoldValueRaw: pick(2),
    totalUnsoldValueRaw: pick(3),
    // position 4 is the parenthetical (skipped)
    totalEstimateRaw: pick(5),
    // position 6 is Total Estimate of Lots Sold (not asserted by plan; skipped in extraction)
    lotsSoldBelowRaw: pick(7),
    lotsSoldWithinRaw: pick(8),
    lotsSoldAboveRaw: pick(9),
    numberOfSellersRaw: pick(10),
    numberOfBuyersRaw: pick(11),
    registeredBiddersRaw: pick(12),
  };
}

function emptyLeftCol(): LeftColumnValues {
  return {
    auctionedLotsRaw: '',
    lotsSoldRaw: '',
    totalSoldValueRaw: '',
    totalUnsoldValueRaw: '',
    totalEstimateRaw: '',
    lotsSoldBelowRaw: '',
    lotsSoldWithinRaw: '',
    lotsSoldAboveRaw: '',
    numberOfSellersRaw: '',
    numberOfBuyersRaw: '',
    registeredBiddersRaw: '',
  };
}

// Silence unused-variable warnings for stray imports.
void RANGE_LIKE_RE;
void MONEY_LIKE_RE;
void LOTS_SOLD_VALUE_RE;

function derivePaymentStatus(inlineFields: Record<string, string>): string | null {
  const paid = parseCount(inlineFields['Paid Invoices (All lots flagged paid)']);
  const unpaid = parseCount(inlineFields['UnPaid Invoices (Not all lots paid)']);
  if (paid === null && unpaid === null) return null;
  const p = paid ?? 0;
  const u = unpaid ?? 0;
  if (u === 0 && p > 0) return 'paid';
  if (p > 0 && u > 0) return 'partial';
  if (p === 0 && u > 0) return 'unpaid';
  return null;
}

export function parseSalePage(
  pageText: string,
  opts: { sourcePdfPath: string },
): Omit<SaleRecord, 'imported_at'> {
  const lines = pageText.split('\n').map((l) => l.replace(/\r$/, ''));

  // Tab-separated right-column fields (monetary).
  const tabFields: Record<string, string> = {};
  // Inline "Label: Value" fields.
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

  // Header: "Auction Profile for Sale IT254, November 16, 2022"
  const headerIdx = lines.findIndex((l) => HEADER_RE.test(l.trim()));
  const headerM = headerIdx >= 0 ? HEADER_RE.exec(lines[headerIdx].trim()) : null;
  const sale_number = headerM?.groups?.sale ?? '';
  let sale_date: string | null = null;
  if (headerM?.groups?.date) {
    const d = new Date(headerM.groups.date);
    if (!Number.isNaN(d.getTime())) {
      sale_date = d.toISOString().slice(0, 10);
    }
  }
  // Title is the line immediately following the header.
  const rawTitle = headerIdx >= 0 ? (lines[headerIdx + 1] ?? '').trim() : '';
  const title = rawTitle || `Sale ${sale_number || 'Unknown'}`;

  const leftCol = extractLeftColumnValues(lines);
  const auctionedLots = parseAuctionedLots(leftCol.auctionedLotsRaw);
  const lotsSold = parseLotsSold(leftCol.lotsSoldRaw);
  const totalEstimate = parseMoneyRange(leftCol.totalEstimateRaw);

  const lots_auctioned = auctionedLots.count;
  const lots_sold = lotsSold.count;
  const lots_unsold =
    lots_auctioned != null && lots_sold != null ? lots_auctioned - lots_sold : null;

  return {
    sale_number,
    title,
    sale_date,
    lots_auctioned,
    lots_sold,
    lots_unsold,
    total_sold_value: parseMoney(leftCol.totalSoldValueRaw),
    total_unsold_value: parseMoney(leftCol.totalUnsoldValueRaw),
    total_low_estimate: totalEstimate.low,
    total_high_estimate: totalEstimate.high,
    total_reserves: parseMoney(inlineFields['Total Reserve']),
    hammer_total: parseMoney(tabFields['Total Hammer Paid']),
    buyer_premium: parseMoney(tabFields['Premium']),
    seller_commission: parseMoney(tabFields['Commission']),
    insurance: parseMoney(tabFields['Insurance']),
    lot_charges: parseMoney(tabFields['Lot Charges']),
    referral_fees: parseMoney(tabFields['Referral Fees']),
    net_revenue: parseMoney(tabFields['Total Net Revenue']),
    registered_bidders: parseCount(leftCol.registeredBiddersRaw),
    winning_buyers: parseCount(leftCol.numberOfBuyersRaw),
    payment_status: derivePaymentStatus(inlineFields),
    source_pdf_path: opts.sourcePdfPath,
    validation_warning: false,
  };
}
