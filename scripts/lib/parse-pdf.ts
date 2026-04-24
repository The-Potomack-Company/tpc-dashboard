// parse-pdf.ts — top-level orchestrator.
// Reads a PDF file, extracts text, runs page parsers, Zod-validates.
// Returns a three-variant discriminated union so callers can distinguish
// 'ok' / 'empty' (62/457 placeholder case) / 'failed' without exceptions.
// T-03 mitigation: every I/O and parsing call is wrapped in try/catch so a
// malformed PDF cannot crash the batch importer.

import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import { parseSalePage } from './parsers/sale-page.js';
import { parseDepartmentPage } from './parsers/department-page.js';
import {
  SaleRecordSchema,
  SaleDepartmentRecordSchema,
  type SaleRecord,
  type SaleDepartmentRecord,
} from './schemas.js';

export type ParseResult =
  | { status: 'ok'; sale: SaleRecord; departments: SaleDepartmentRecord[] }
  | { status: 'empty' }
  | { status: 'failed'; error: string };

// Observed empty placeholder is exactly 1182 bytes. Use a small margin above
// that as a fast-path heuristic; we still inspect the extracted text to confirm.
const EMPTY_FAST_PATH_MAX_BYTES = 1200;

export async function parsePdf(filePath: string): Promise<ParseResult> {
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (err) {
    return {
      status: 'failed',
      error: `read: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Fast path for the 62/457 empty placeholders: 1182 bytes with 1 page / 0 chars.
  if (buffer.byteLength <= EMPTY_FAST_PATH_MAX_BYTES) {
    try {
      const p = new PDFParse({ data: buffer });
      const r = await p.getText();
      if (r.pages.length === 1 && r.pages[0].text.trim().length === 0) {
        return { status: 'empty' };
      }
    } catch {
      // If a tiny file can't even be parsed by pdf-parse, treat as empty
      // (it's not a real auction profile — won't be in the 395 good files).
      return { status: 'empty' };
    }
  }

  let result: Awaited<ReturnType<PDFParse['getText']>>;
  try {
    const p = new PDFParse({ data: buffer });
    result = await p.getText();
  } catch (err) {
    return {
      status: 'failed',
      error: `pdf-parse: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (
    !result.pages ||
    result.pages.length === 0 ||
    result.pages[0].text.trim().length === 0
  ) {
    return { status: 'empty' };
  }

  try {
    const saleRaw = parseSalePage(result.pages[0].text, { sourcePdfPath: filePath });
    const sale = SaleRecordSchema.parse(saleRaw);

    const departments: SaleDepartmentRecord[] = [];
    for (let i = 1; i < result.pages.length; i++) {
      const deptRaw = parseDepartmentPage(result.pages[i].text);
      // Skip pages without a dept header (e.g., footer-only continuation pages).
      if (!deptRaw.code) continue;
      const dept = SaleDepartmentRecordSchema.parse(deptRaw);
      departments.push(dept);
    }

    return { status: 'ok', sale, departments };
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
