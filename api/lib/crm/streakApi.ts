import { StreakRateLimited, type StreakBox } from './types.js';

const STREAK_V1_BASE = 'https://www.streak.com/api/v1';
const STREAK_V2_BASE = 'https://api.streak.com/api/v2';
const CLOSED_STAGE_NAME_PATTERN = /^(closed|won|lost|archived|done|completed)/i;
const BOXES_PAGE_LIMIT = 200;
const DEFAULT_MAX_BOXES_PER_POLL = 15;

type StreakStageApiRecord = {
  key?: unknown;
  stageKey?: unknown;
  name?: unknown;
  // Streak v1 /stages may return color under any of these names depending on
  // pipeline vintage. Extract whichever is present; persist as a normalized
  // hex string in crm_threads.streak_stage_color. NULL when none present →
  // UI falls back to a deterministic hash-from-stage-name palette.
  color?: unknown;
  colorHex?: unknown;
  hexColor?: unknown;
  hex?: unknown;
};

type StreakBoxApiRecord = {
  key?: unknown;
  boxKey?: unknown;
  name?: unknown;
  stageKey?: unknown;
  stageName?: unknown;
  lastUpdatedTimestamp?: unknown;
  lastEmailReceivedTimestamp?: unknown;
  assignedToSharingEntries?: unknown[];
  gmailThreadId?: unknown;
  gmailThreadIds?: unknown;
  threadId?: unknown;
  threadIds?: unknown;
  subject?: unknown;
  fromEmail?: unknown;
  firstEmailFrom?: unknown;
  fromName?: unknown;
  snippet?: unknown;
};

type StreakBoxThreadRecord = {
  threadGmailId?: unknown;
  gmailThreadId?: unknown;
};

type StreakV2BoxesPage = {
  results?: StreakBoxApiRecord[];
  hasNextPage?: boolean;
};

export async function listOpenBoxes(config: {
  apiKey?: string;
  pipelineKey: string;
  closedStageKeys?: string[];
  maxBoxes?: number;
}): Promise<StreakBox[]> {
  const apiKey = config.apiKey ?? readRequiredEnv('STREAK_API_KEY');
  const headers = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
  };

  // v1 still owns /stages — v2 returns 400 on it as of 2026-05.
  const stagesRaw = await streakFetch<StreakStageApiRecord[]>(
    `${STREAK_V1_BASE}/pipelines/${encodeURIComponent(config.pipelineKey)}/stages`,
    headers,
  );
  // Streak v1 /pipelines/<key>/stages returns an OBJECT keyed by stage key
  // (e.g. {"5001":{...},"5020":{...}}), not an array. Older shapes may return
  // an array directly or a {results:[]} wrapper.
  const stages = normalizeStagesResponse(stagesRaw);
  console.error('[crm-debug] v1 /stages →', JSON.stringify({
    rawType: Array.isArray(stagesRaw) ? 'array' : typeof stagesRaw,
    stagesLength: stages.length,
    firstStage: stages[0] ?? null,
  }));

  const stageNameByKey = new Map(
    stages
      .map((stage) => [toStringValue(stage.key ?? stage.stageKey), toStringValue(stage.name)] as const)
      .filter(([key]) => key.length > 0),
  );

  const stageColorByKey = new Map(
    stages
      .map(
        (stage) =>
          [
            toStringValue(stage.key ?? stage.stageKey),
            normalizeStageColor(stage.colorHex ?? stage.color ?? stage.hexColor ?? stage.hex),
          ] as const,
      )
      .filter(([key, color]) => key.length > 0 && color.length > 0),
  );

  const explicitClosedKeys = new Set(config.closedStageKeys ?? [...parseCsv(process.env.STREAK_CLOSED_STAGE_KEYS)]);

  // Determine open stages we should iterate. If env-configured closed keys are
  // present, use those as a blocklist; otherwise fall back to the name pattern.
  const openStageKeys = stages
    .map((stage) => toStringValue(stage.key ?? stage.stageKey))
    .filter((key) => key.length > 0)
    .filter((key) => {
      if (explicitClosedKeys.size > 0) {
        return !explicitClosedKeys.has(key);
      }
      const name = stageNameByKey.get(key) ?? '';
      return !CLOSED_STAGE_NAME_PATTERN.test(name);
    });

  console.error('[crm-debug] openStageKeys →', JSON.stringify({
    closedKeysSize: explicitClosedKeys.size,
    closedKeys: [...explicitClosedKeys],
    openCount: openStageKeys.length,
    openKeys: openStageKeys.slice(0, 5),
    allStageNames: [...stageNameByKey.entries()].map(([k, n]) => `${k}:${n}`),
  }));

  // Fetch first page of each open stage in PARALLEL, merge, sort by
  // lastEmailReceivedTimestamp desc, take top maxBoxes. Surfaces the
  // most-recently-emailed leads across the pipeline rather than draining
  // stage 5001's backlog first.
  const envMax = Number(process.env.STREAK_MAX_BOXES_PER_POLL);
  const maxBoxes =
    config.maxBoxes ?? (Number.isFinite(envMax) && envMax > 0 ? envMax : DEFAULT_MAX_BOXES_PER_POLL);

  const perStagePages = await Promise.all(
    openStageKeys.map(async (stageKey) => {
      const url =
        `${STREAK_V2_BASE}/pipelines/${encodeURIComponent(config.pipelineKey)}/boxes` +
        `?stageKey=${encodeURIComponent(stageKey)}` +
        `&limit=${BOXES_PAGE_LIMIT}` +
        `&offset=0`;
      try {
        const page = await streakFetch<StreakV2BoxesPage>(url, headers);
        const results = page.results ?? [];
        return { stageKey, results, resultsLength: results.length };
      } catch (error) {
        console.error(
          '[crm-debug] stage fetch failed',
          stageKey,
          error instanceof Error ? error.message : String(error),
        );
        return { stageKey, results: [] as StreakBoxApiRecord[], resultsLength: 0 };
      }
    }),
  );

  console.error(
    '[crm-debug] per-stage fetch →',
    JSON.stringify({
      stages: perStagePages.map((p) => ({ stageKey: p.stageKey, count: p.resultsLength })),
    }),
  );

  const merged: StreakBox[] = perStagePages.flatMap((page) =>
    page.results.map((box) => normalizeBox(box, stageNameByKey, stageColorByKey)),
  );

  // Sort by last email received desc (falls back to lastUpdatedTimestamp).
  merged.sort((a, b) => {
    const av = a.lastEmailReceivedTimestamp || a.lastUpdatedTimestamp;
    const bv = b.lastEmailReceivedTimestamp || b.lastUpdatedTimestamp;
    return bv - av;
  });
  const collected = merged.slice(0, maxBoxes);
  console.error(
    '[crm-debug] collected →',
    JSON.stringify({ mergedLength: merged.length, collectedLength: collected.length, maxBoxes }),
  );

  // v2 /boxes does not include Gmail thread IDs (only gmailThreadCount).
  // Fetch them per box via v1 /boxes/<key>/threads. Skip boxes that already
  // have thread IDs (defensive — older shapes may have them inline).
  for (const box of collected) {
    if (box.gmailThreadIds && box.gmailThreadIds.length > 0) {
      continue;
    }
    box.gmailThreadIds = await fetchBoxThreadIds(box.key, headers);
  }

  return collected;
}

async function fetchBoxThreadIds(
  boxKey: string,
  headers: Record<string, string>,
): Promise<string[]> {
  if (!boxKey) return [];
  const url = `${STREAK_V1_BASE}/boxes/${encodeURIComponent(boxKey)}/threads`;
  const records = await streakFetch<StreakBoxThreadRecord[]>(url, headers);
  return toArray(records)
    .map((thread) => toStringValue(thread.threadGmailId ?? thread.gmailThreadId))
    .filter((id) => id.length > 0);
}

async function streakFetch<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers });

  if (response.status === 429) {
    throw new StreakRateLimited(parseRetryAfterMs(response.headers.get('retry-after')));
  }

  if (response.status >= 500) {
    throw new Error(`Streak API request failed with ${response.status} on ${url}`);
  }

  if (!response.ok) {
    throw new Error(`Streak API request failed with ${response.status} on ${url}`);
  }

  return (await response.json()) as T;
}

function normalizeBox(
  box: StreakBoxApiRecord,
  stageNameByKey: Map<string, string>,
  stageColorByKey: Map<string, string>,
): StreakBox {
  const stageKey = toStringValue(box.stageKey);
  const gmailThreadIds = toStringArray(box.gmailThreadIds ?? box.threadIds ?? box.gmailThreadId ?? box.threadId);
  const name = toStringValue(box.name);
  // v2 boxes don't carry subject inline — fall back to box name (the consignor
  // label staff use in Streak) so triage UI has something to display.
  const subject = toStringValue(box.subject) || name;
  // v2 boxes expose the consignor address as firstEmailFrom, not fromEmail.
  const fromEmail = toStringValue(box.fromEmail) || toStringValue(box.firstEmailFrom);
  const fromName = toStringValue(box.fromName);
  const snippet = toStringValue(box.snippet);
  const stageColor = stageColorByKey.get(stageKey) ?? '';

  return {
    key: toStringValue(box.key ?? box.boxKey),
    name,
    stageKey,
    stageName: toStringValue(box.stageName) || stageNameByKey.get(stageKey) || '',
    lastUpdatedTimestamp: toNumberValue(box.lastUpdatedTimestamp),
    lastEmailReceivedTimestamp: toNumberValue(box.lastEmailReceivedTimestamp),
    assignedToSharingEntries: box.assignedToSharingEntries,
    ...(stageColor ? { stageColor } : {}),
    ...(gmailThreadIds.length > 0 ? { gmailThreadIds } : {}),
    ...(subject ? { subject } : {}),
    ...(fromEmail ? { fromEmail } : {}),
    ...(fromName ? { fromName } : {}),
    ...(snippet ? { snippet } : {}),
  };
}

function parseCsv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

function readRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}

function toArray<T>(value: T[] | { results?: T[]; data?: T[] }): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value.results)) {
    return value.results;
  }

  return Array.isArray(value.data) ? value.data : [];
}

function normalizeStagesResponse(value: unknown): StreakStageApiRecord[] {
  if (Array.isArray(value)) {
    return value as StreakStageApiRecord[];
  }
  if (value && typeof value === 'object') {
    const maybeWrapped = value as { results?: unknown; data?: unknown };
    if (Array.isArray(maybeWrapped.results)) {
      return maybeWrapped.results as StreakStageApiRecord[];
    }
    if (Array.isArray(maybeWrapped.data)) {
      return maybeWrapped.data as StreakStageApiRecord[];
    }
    // Object keyed by stage key — merge the key into the record under `key`
    // so the downstream toStringValue(stage.key ?? stage.stageKey) call works.
    return Object.entries(value as Record<string, StreakStageApiRecord>).map(([key, record]) => ({
      ...(record ?? {}),
      key: (record && typeof record === 'object' && 'key' in record ? record.key : undefined) ?? key,
    }));
  }
  return [];
}

// Normalize a Streak stage color value into a 7-char hex string (#RRGGBB).
// Streak APIs have been observed returning bare 6-char hex (no #), #RRGGBB,
// rgb()-style strings, and integer-encoded colors depending on pipeline age.
// Returns '' (treated as absent) when input doesn't parse to a hex color.
function normalizeStageColor(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
      return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
    }
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 0xffffff) {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  return '';
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

function toNumberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
