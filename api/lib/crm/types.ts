export type StreakBox = {
  key: string;
  name: string;
  stageKey: string;
  stageName: string;
  lastUpdatedTimestamp: number;
  lastEmailReceivedTimestamp: number;
  assignedToSharingEntries?: unknown[];
  gmailThreadIds?: string[];
  subject?: string;
  fromEmail?: string;
  fromName?: string;
  snippet?: string;
};

export type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  body: string;
};

export type GmailImageAttachment = {
  mimeType: string;
  data: string; // base64 (standard, not url-safe — Gemini inlineData spec)
};

export type GmailThreadContent = {
  text: string;
  images: GmailImageAttachment[];
};

export type ClassifierInput = {
  boxKey: string;
  boxName: string;
  stageKey: string;
  stageName: string;
  gmailBody?: string;
  gmailImages?: GmailImageAttachment[];
  senderEmail?: string;
  lastUpdatedMs: number;
};

export type ClassifierOutput = {
  department: string[];
  priority: 'high' | 'standard' | 'low';
  rationale: string;
  model: string;
  needsReview?: boolean;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  };
};

export type UsageRecord = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  callerFunction: string;
  appSlug: string;
};

export class GmailVerbForbidden extends Error {
  constructor(verb: string) {
    super(`Gmail verb is not allowed for CRM read-only demo: ${verb}`);
    this.name = 'GmailVerbForbidden';
  }
}

export class ClassifierBudgetExceeded extends Error {
  constructor(count: number) {
    super(`CRM classifier invocation budget exceeded: ${count}`);
    this.name = 'ClassifierBudgetExceeded';
  }
}

export class StreakRateLimited extends Error {
  readonly retryAfterMs?: number;

  constructor(retryAfterMs?: number) {
    super('Streak API rate limit exceeded');
    this.name = 'StreakRateLimited';
    this.retryAfterMs = retryAfterMs;
  }
}
