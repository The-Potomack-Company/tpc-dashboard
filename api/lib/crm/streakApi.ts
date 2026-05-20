import { StreakRateLimited, type StreakBox } from './types';

const STREAK_API_BASE = 'https://www.streak.com/api/v1';
const CLOSED_STAGE_NAME_PATTERN = /^(closed|won|lost|archived|done|completed)/i;

type StreakStageApiRecord = {
  key?: unknown;
  stageKey?: unknown;
  name?: unknown;
};

type StreakBoxApiRecord = {
  key?: unknown;
  boxKey?: unknown;
  name?: unknown;
  stageKey?: unknown;
  stageName?: unknown;
  lastUpdatedTimestamp?: unknown;
  assignedToSharingEntries?: unknown[];
  gmailThreadId?: unknown;
  gmailThreadIds?: unknown;
  threadId?: unknown;
  threadIds?: unknown;
  subject?: unknown;
  fromEmail?: unknown;
  fromName?: unknown;
  snippet?: unknown;
};

export async function listOpenBoxes(config: {
  apiKey?: string;
  pipelineKey: string;
  closedStageKeys?: string[];
}): Promise<StreakBox[]> {
  const apiKey = config.apiKey ?? readRequiredEnv('STREAK_API_KEY');
  const headers = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
  };

  const stages = await streakFetch<StreakStageApiRecord[]>(
    `${STREAK_API_BASE}/pipelines/${encodeURIComponent(config.pipelineKey)}/stages`,
    headers,
  );
  const stageNameByKey = new Map(
    toArray(stages)
      .map((stage) => [toStringValue(stage.key ?? stage.stageKey), toStringValue(stage.name)] as const)
      .filter(([key]) => key.length > 0),
  );

  const boxes = await streakFetch<StreakBoxApiRecord[]>(
    `${STREAK_API_BASE}/pipelines/${encodeURIComponent(config.pipelineKey)}/boxes`,
    headers,
  );

  const closedStageKeys = new Set(config.closedStageKeys ?? [...parseCsv(process.env.STREAK_CLOSED_STAGE_KEYS)]);

  return toArray(boxes)
    .map((box) => normalizeBox(box, stageNameByKey))
    .filter((box) => {
      if (closedStageKeys.size > 0) {
        return !closedStageKeys.has(box.stageKey);
      }

      return !CLOSED_STAGE_NAME_PATTERN.test(box.stageName);
    });
}

async function streakFetch<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers });

  if (response.status === 429) {
    throw new StreakRateLimited(parseRetryAfterMs(response.headers.get('retry-after')));
  }

  if (response.status >= 500) {
    throw new Error(`Streak API request failed with ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`Streak API request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeBox(box: StreakBoxApiRecord, stageNameByKey: Map<string, string>): StreakBox {
  const stageKey = toStringValue(box.stageKey);
  const gmailThreadIds = toStringArray(box.gmailThreadIds ?? box.threadIds ?? box.gmailThreadId ?? box.threadId);
  const subject = toStringValue(box.subject);
  const fromEmail = toStringValue(box.fromEmail);
  const fromName = toStringValue(box.fromName);
  const snippet = toStringValue(box.snippet);

  return {
    key: toStringValue(box.key ?? box.boxKey),
    name: toStringValue(box.name),
    stageKey,
    stageName: toStringValue(box.stageName) || stageNameByKey.get(stageKey) || '',
    lastUpdatedTimestamp: toNumberValue(box.lastUpdatedTimestamp),
    assignedToSharingEntries: box.assignedToSharingEntries,
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

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
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
