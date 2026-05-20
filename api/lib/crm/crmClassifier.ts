import { GoogleGenerativeAI } from '@google/generative-ai';
import { ClassifierBudgetExceeded, type ClassifierInput, type ClassifierOutput } from './types.js';

const MODEL = 'gemini-2.5-flash';
const MAX_INVOCATIONS_PER_EXECUTION = 200;
const VALID_DEPARTMENTS = ['furniture', 'decarts', 'books', 'fashion', 'art_sculpture'] as const;
const VALID_DEPARTMENT_SET = new Set<string>(VALID_DEPARTMENTS);
const VALID_PRIORITIES = new Set(['high', 'standard', 'low']);
const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

let invocationCount = 0;

export async function classify(input: ClassifierInput): Promise<ClassifierOutput> {
  invocationCount += 1;
  if (invocationCount > MAX_INVOCATIONS_PER_EXECUTION) {
    throw new ClassifierBudgetExceeded(invocationCount);
  }

  const apiKey = readRequiredEnv('GEMINI_API_KEY');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(buildPrompt(input));
  const parsed = parseClassifierJson(result.response.text());
  return applyDeterministicOverrides(parsed, input);
}

export function __resetClassifierInvocationCountForTests(): void {
  resetClassifierInvocationBudget();
}

export function resetClassifierInvocationBudget(): void {
  invocationCount = 0;
}

function buildPrompt(input: ClassifierInput): string {
  return `You classify real inbound consignment CRM threads for TPC.

D-036 department taxonomy, return one or more only from:
furniture | decarts | books | fashion | art_sculpture

Priority calibration target:
~10% HIGH / 60% STD / 30% LOW. HIGH is exceptional.

Priority signals:
- deal value + completeness: signed art, antiques, jewelry, photos, dimensions, provenance
- time-sensitivity: explicit deadlines, moving dates, estate sale dates, quote needed by a date
- sender identity: known VIP domain should be treated as high intent
- scope: multi-department or estate-level breadth can raise priority when value supports it

Rationale requirements (IMPORTANT):
- Quote 1-2 specific phrases from the gmailBody in double quotes — these are the evidence
- For each quoted phrase, name which signal it triggered (value/time/sender/scope)
- If a phrase justifies the department tags, quote it too
- If the body is empty or unreadable, say so explicitly and tag priority="low"
- 2-3 sentences total, evidence-first, no generic hedging

Example rationale:
"Two signed Léger lithographs with COA and provenance docs" — high value + info completeness; multi-department implied by "plus dining room set and china collection" so tagged furniture, decarts, art_sculpture.

Return JSON only:
{"department":["furniture"],"priority":"high"|"standard"|"low","rationale":"evidence-first 2-3 sentences quoting specific phrases","model":"${MODEL}"}

Thread:
boxKey: ${input.boxKey}
boxName: ${input.boxName}
stageKey: ${input.stageKey}
stageName: ${input.stageName}
senderEmail: ${input.senderEmail ?? ''}
lastUpdatedMs: ${input.lastUpdatedMs}
gmailBody:
${input.gmailBody ?? ''}`;
}

function parseClassifierJson(text: string): ClassifierOutput {
  const json = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(json) as Partial<ClassifierOutput>;
  const department = Array.isArray(parsed.department)
    ? parsed.department.filter((value): value is string => {
        return typeof value === 'string' && VALID_DEPARTMENT_SET.has(value);
      })
    : [];

  return {
    department: department.length > 0 ? department : ['decarts'],
    priority: isPriority(parsed.priority) ? parsed.priority : 'standard',
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : 'Classifier returned incomplete rationale.',
    model: typeof parsed.model === 'string' ? parsed.model : MODEL,
    needsReview: department.length === 0 ? true : parsed.needsReview,
  };
}

function applyDeterministicOverrides(output: ClassifierOutput, input: ClassifierInput): ClassifierOutput {
  const gmailBody = input.gmailBody ?? '';

  if (isEmptyBody(gmailBody)) {
    return {
      ...output,
      priority: 'low',
      needsReview: true,
    };
  }

  if (isVipSender(input.senderEmail) || hasDeadlineWithinSevenDays(gmailBody, new Date())) {
    return {
      ...output,
      priority: 'high',
    };
  }

  return output;
}

function isVipSender(senderEmail: string | undefined): boolean {
  const domain = senderEmail?.split('@').at(1)?.trim().toLowerCase();
  if (!domain) {
    return false;
  }

  return parseCsv(process.env.STREAK_VIP_DOMAINS).some((vipDomain) => {
    const normalized = vipDomain.toLowerCase();
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

function hasDeadlineWithinSevenDays(body: string, now: Date): boolean {
  const lowerBody = body.toLowerCase();
  if (!/(deadline|by|before|closing|moving|move|sale|pickup|quote|need)/i.test(body)) {
    return false;
  }

  const dates = [...extractIsoDates(lowerBody, now), ...extractMonthDates(lowerBody, now), ...extractRelativeDates(lowerBody, now)];
  const todayStart = startOfDay(now).getTime();
  const sevenDaysFromNow = todayStart + 7 * 24 * 60 * 60 * 1_000;

  return dates.some((date) => {
    const dateMs = startOfDay(date).getTime();
    return dateMs >= todayStart && dateMs <= sevenDaysFromNow;
  });
}

function extractIsoDates(body: string, now: Date): Date[] {
  return [...body.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)]
    .map((match) => new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    .filter((date) => isValidDate(date, now));
}

function extractMonthDates(body: string, now: Date): Date[] {
  return [
    ...body.matchAll(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?\b/g,
    ),
  ]
    .map((match) => {
      const month = MONTHS[match[1]];
      const day = Number(match[2]);
      const year = match[3] ? Number(match[3]) : now.getFullYear();
      return new Date(year, month, day);
    })
    .filter((date) => isValidDate(date, now));
}

function extractRelativeDates(body: string, now: Date): Date[] {
  const dates: Date[] = [];
  if (/\btoday\b/.test(body)) {
    dates.push(addDays(now, 0));
  }
  if (/\btomorrow\b/.test(body)) {
    dates.push(addDays(now, 1));
  }

  const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const weekday of weekdayNames) {
    if (new RegExp(`\\b${weekday}\\b`).test(body)) {
      const target = weekdayNames.indexOf(weekday);
      const distance = (target - now.getDay() + 7) % 7 || 7;
      dates.push(addDays(now, distance));
    }
  }

  return dates;
}

function isEmptyBody(body: string): boolean {
  return body.trim().length === 0;
}

function isPriority(value: unknown): value is ClassifierOutput['priority'] {
  return typeof value === 'string' && VALID_PRIORITIES.has(value);
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function isValidDate(date: Date, now: Date): boolean {
  return Number.isFinite(date.getTime()) && date.getFullYear() >= now.getFullYear();
}

function readRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}
