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

Priority signal ranking:
1. Value dominates. Value is per-lot, not gross: 1 x $800 item outranks 10 x $100 items because fewer larger lots are cheaper to process.
2. Time is co-dominant only when present:
   - explicit deadline, moving date, estate-sale date, or quote-needed-by date in the body
   - thread staleness; long-quiet threads may need a probe
   - last-message intent: if the most recent message says items were sent for estimates, waiting on an appraiser, or "will let you know when...", treat as holding-phase -> LOW unless daysSinceLastMessage > 14, then resurface to STD or HIGH if other signals support it
   - precedence: the holding-phase clause wins over value when daysSinceLastMessage <= 14, except when the body contains an explicit deadline date within the next 7 days; then value+time win
3. Scope is a tiebreaker. Multi-department breadth raises priority only when value already supports it.
4. Visual evidence multiplies confidence. Photos verify weak text claims; clear photos may move vague value language to the next higher bin. Example: "two signed lithographs" with photos > "some old paintings" with photos > the same text without photos.

Department tiebreakers:
- art_sculpture: fine-art originals, signed prints, sculpture as fine art.
- decarts: decorative or functional decorative arts, including ceramics, glassware, metalwork, lighting.
- books: printed or bound reading material; prints or illustrated art go to art_sculpture instead.
- fashion: wearable clothing/accessories; decarts wearables like jewelry go to decarts unless explicitly costume or fashion-wearable, in which case fashion wins.
- furniture: case goods, seating, tables. Carved decorative chairs are furniture; if also signed as fine art, multi-tag with art_sculpture.
- Multi-tag genuinely ambiguous lots, and quote the phrase that triggered each department tag.

Rationale requirements (IMPORTANT):
- Quote 1-2 specific phrases from the gmailBody in double quotes — these are the evidence
- For each quoted phrase, name which signal it triggered (value/time/scope/visual)
- If photos were attached (${imageCount} image(s) included), describe what you see in 1 short clause and weigh it
- If a phrase justifies the department tags, quote it too
- If lastMessageBody changes the priority, quote that phrase and name the last-message/time signal
- If the body is empty or unreadable AND no photos attached, say so explicitly and tag priority="low"
- 2-3 sentences total, evidence-first, no generic hedging

Few-shot examples:
HIGH: "Two signed Leger lithographs with COA and provenance docs" signals high per-lot value and complete evidence; "moving on June 3" adds explicit time pressure; image part 1 shows a framed signed print matching the description, so tagged art_sculpture.
STANDARD: "estate contents include a mahogany table, china service, and several lamps" is a normal estate inquiry with decent value and furniture/decarts scope, but no deadline and no photos, so priority standard.
LOW: Last message says "sent the items to the appraiser and will follow up" and daysSinceLastMessage=3, so this is holding-phase LOW; resurface to standard if daysSinceLastMessage > 14 and the thread still needs a nudge.
LOW: "Large signed painting collection worth over $50,000" has high value, but last message says "waiting on the appraiser and will let you know" with daysSinceLastMessage=10, so holding-phase wins and priority is low.
STANDARD: Last message says "waiting on the appraiser and will let you know" with daysSinceLastMessage=15, so this is past the holding window and should resurface to standard.

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
lastMessageDate: ${input.lastMessageDate}
daysSinceLastMessage: ${input.daysSinceLastMessage}
threadAgeDays: ${input.threadAgeDays}
lastMessageBody:
${input.lastMessageBody}

gmailBody:
${input.gmailBody ?? ''}`;
}

function parseClassifierJson(text: string): ClassifierOutput {
  const json = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(json) as Partial<ClassifierOutput>;
  let hadInvalidDepartment = false;
  const department = Array.isArray(parsed.department)
    ? parsed.department.filter((value): value is string => {
        const isValidDepartment = typeof value === 'string' && VALID_DEPARTMENT_SET.has(value);
        hadInvalidDepartment ||= !isValidDepartment;
        return isValidDepartment;
      })
    : [];

  const hasValidPriority = isPriority(parsed.priority);

  return {
    department,
    priority: hasValidPriority ? parsed.priority : 'standard',
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : 'Classifier returned incomplete rationale.',
    model: typeof parsed.model === 'string' ? parsed.model : MODEL,
    needsReview: department.length === 0 || hadInvalidDepartment || !hasValidPriority ? true : parsed.needsReview,
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
