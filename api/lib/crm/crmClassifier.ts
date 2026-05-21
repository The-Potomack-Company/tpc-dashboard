import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { ClassifierBudgetExceeded, type ClassifierInput, type ClassifierOutput } from './types.js';

const MODEL = 'gemini-2.5-flash';
const MAX_INVOCATIONS_PER_EXECUTION = 200;
const VALID_DEPARTMENTS = ['furniture', 'decarts', 'books', 'fashion', 'art_sculpture'] as const;
const VALID_DEPARTMENT_SET = new Set<string>(VALID_DEPARTMENTS);
const VALID_PRIORITIES = new Set(['high', 'standard', 'low']);

let invocationCount = 0;

export async function classify(input: ClassifierInput): Promise<ClassifierOutput> {
  invocationCount += 1;
  if (invocationCount > MAX_INVOCATIONS_PER_EXECUTION) {
    throw new ClassifierBudgetExceeded(invocationCount);
  }

  const apiKey = readRequiredEnv('GEMINI_API_KEY');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });
  const parts: Part[] = [{ text: buildPrompt(input) }];
  for (const img of input.gmailImages ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  const result = await model.generateContent(parts);
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
  const imageCount = input.gmailImages?.length ?? 0;
  return `You classify real inbound consignment CRM threads for TPC.

D-036 department taxonomy, return one or more only from:
furniture | decarts | books | fashion | art_sculpture

Priority calibration target:
~10% HIGH / 60% STD / 30% LOW. HIGH is exceptional.

Priority signals:
- deal value + completeness: signed art, antiques, jewelry, photos attached, dimensions, provenance docs
- time-sensitivity: explicit deadlines, moving dates, estate sale dates, quote needed by a date
- scope: multi-department or estate-level breadth can raise priority when value supports it
- visual evidence: if photos are attached (see image parts in this request), inspect them and treat clear shots of items as info-completeness signals; describe what you see in the rationale

Rationale requirements (IMPORTANT):
- Quote 1-2 specific phrases from the gmailBody in double quotes — these are the evidence
- For each quoted phrase, name which signal it triggered (value/time/scope/visual)
- If photos were attached (${imageCount} image(s) included), describe what you see in 1 short clause and weigh it
- If a phrase justifies the department tags, quote it too
- If the body is empty or unreadable AND no photos attached, say so explicitly and tag priority="low"
- 2-3 sentences total, evidence-first, no generic hedging

Example rationale:
"Two signed Léger lithographs with COA and provenance docs" — high value + info completeness; image part 1 shows a framed signed print matching the description; multi-department implied by "plus dining room set and china collection" so tagged furniture, decarts, art_sculpture.

Return JSON only:
{"department":["furniture"],"priority":"high"|"standard"|"low","rationale":"evidence-first 2-3 sentences quoting specific phrases","model":"${MODEL}"}

Thread:
boxKey: ${input.boxKey}
boxName: ${input.boxName}
stageKey: ${input.stageKey}
stageName: ${input.stageName}
senderEmail: ${input.senderEmail ?? ''}
lastUpdatedMs: ${input.lastUpdatedMs}
attachedImageCount: ${imageCount}
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

  const hasValidPriority = isPriority(parsed.priority);

  return {
    department,
    priority: hasValidPriority ? parsed.priority : 'standard',
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : 'Classifier returned incomplete rationale.',
    model: typeof parsed.model === 'string' ? parsed.model : MODEL,
    needsReview: department.length === 0 || !hasValidPriority ? true : parsed.needsReview,
  };
}

function applyDeterministicOverrides(output: ClassifierOutput, input: ClassifierInput): ClassifierOutput {
  const gmailBody = input.gmailBody ?? '';
  const hasImages = (input.gmailImages?.length ?? 0) > 0;

  // Only override: truly empty input (no text AND no images) → low + needsReview.
  // Deadline regex + VIP domain override both dropped per 2026-05-20 discussion —
  // - VIP overmatched forwarding aliases (admin@invaluable.com isn't a person)
  // - deadline keywords (by/before/closing/...) appear in nearly every email and
  //   the proximity-to-date logic produced false positives
  // The LLM is responsible for picking up time-sensitivity from the body text now.
  if (isEmptyBody(gmailBody) && !hasImages) {
    return {
      ...output,
      priority: 'low',
      needsReview: true,
    };
  }

  return output;
}

function isEmptyBody(body: string): boolean {
  return body.trim().length === 0;
}

function isPriority(value: unknown): value is ClassifierOutput['priority'] {
  return typeof value === 'string' && VALID_PRIORITIES.has(value);
}

function readRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}
