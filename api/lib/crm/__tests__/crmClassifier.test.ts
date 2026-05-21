import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassifierBudgetExceeded } from '../types';

const geminiMocks = vi.hoisted(() => {
  const generateContent = vi.fn();
  const getGenerativeModel = vi.fn(() => ({ generateContent }));
  const GoogleGenerativeAI = vi.fn(function GoogleGenerativeAI() {
    return { getGenerativeModel };
  });
  return { generateContent, getGenerativeModel, GoogleGenerativeAI };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: geminiMocks.GoogleGenerativeAI,
}));

const OLD_ENV = process.env;
const VALID_DEPARTMENTS = ['furniture', 'decarts', 'books', 'fashion', 'art_sculpture'];

describe('classify', () => {
  beforeEach(async () => {
    process.env = { ...OLD_ENV, GEMINI_API_KEY: 'gemini-key' };
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00-04:00'));
    vi.clearAllMocks();
    const { __resetClassifierInvocationCountForTests } = await import('../crmClassifier');
    __resetClassifierInvocationCountForTests();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.useRealTimers();
  });

  it('returns a valid ClassifierOutput shape from LLM JSON', async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({
      department: ['furniture', 'art_sculpture'],
      priority: 'standard',
      rationale: 'Mixed estate with enough detail for specialist routing.',
      model: 'gemini-2.5-flash',
    });

    await expect(classify(input({ gmailBody: 'Dining table and signed painting with photos.' }))).resolves.toEqual({
      department: ['furniture', 'art_sculpture'],
      priority: 'standard',
      rationale: 'Mixed estate with enough detail for specialist routing.',
      model: 'gemini-2.5-flash',
      needsReview: undefined,
    });
  });

  it("preserves LLM priority without VIP override (override dropped 2026-05-20)", async () => {
    const { classify } = await import('../crmClassifier');
    process.env.STREAK_VIP_DOMAINS = 'vip-estates.com';
    mockGeminiJson({ department: ['books'], priority: 'low' });

    const output = await classify(input({ senderEmail: 'agent@vip-estates.com', gmailBody: 'Book collection.' }));

    // VIP-sender no longer auto-bumps to HIGH — LLM judgment wins.
    expect(output.priority).toBe('low');
  });

  it("preserves LLM priority without deadline override (override dropped 2026-05-20)", async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({ department: ['decarts'], priority: 'low' });

    const output = await classify(input({ gmailBody: 'We are moving and need a quote by 2026-05-23.' }));

    // Deadline-regex no longer auto-bumps to HIGH — LLM is responsible for
    // picking up time-sensitivity directly from the body.
    expect(output.priority).toBe('low');
  });

  it("forces priority='low' and needsReview=true for empty body", async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({ department: ['fashion'], priority: 'high' });

    const output = await classify(input({ gmailBody: '   ' }));

    expect(output).toMatchObject({ priority: 'low', needsReview: true });
  });

  it('throws ClassifierBudgetExceeded after more than 200 invocations', async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({ department: ['decarts'], priority: 'standard' }, 200);

    for (let count = 0; count < 200; count += 1) {
      await classify(input({ gmailBody: 'Decorative arts lot.' }));
    }

    await expect(classify(input({ gmailBody: 'Decorative arts lot.' }))).rejects.toThrow(ClassifierBudgetExceeded);
  });

  it('filters output department array to valid D-036 tags only', async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({ department: ['furniture', 'cars', 'art_sculpture'], priority: 'standard' });

    const output = await classify(input({ gmailBody: 'Furniture and sculpture.' }));

    expect(output.department).toEqual(['furniture', 'art_sculpture']);
    expect(output.department.every((department) => VALID_DEPARTMENTS.includes(department))).toBe(true);
  });

  it('returns an empty department array and needsReview=true when the LLM returns no valid tags', async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({ department: ['cars', 'wine'], priority: 'standard' });

    const output = await classify(input({ gmailBody: 'Possible consignment, unclear category.' }));

    expect(output.department).toEqual([]);
    expect(output.needsReview).toBe(true);
  });

  it('falls back to standard and needsReview=true when the LLM returns an invalid priority', async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({ department: ['decarts'], priority: 'urgent' });

    const output = await classify(input({ gmailBody: 'Decorative arts lot.' }));

    expect(output.priority).toBe('standard');
    expect(output.needsReview).toBe(true);
  });

  it("allows holding-phase last-message context to classify as priority='low'", async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({
      department: ['art_sculpture'],
      priority: 'low',
      rationale: '"sent the items to the appraiser and will follow up" is a last-message/time holding signal.',
    });

    const output = await classify(
      input({
        gmailBody: 'Two signed prints. sent the items to the appraiser and will follow up.',
        lastMessageBody: 'sent the items to the appraiser and will follow up.',
        daysSinceLastMessage: 3,
      }),
    );

    expect(output).toMatchObject({ priority: 'low', needsReview: undefined });
  });

  it('does not force stale holding-phase threads to low when the model resurfaces them', async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({
      department: ['art_sculpture'],
      priority: 'standard',
      rationale: '"sent the items to the appraiser and will follow up" is stale after 20 days, so resurface.',
    });

    const output = await classify(
      input({
        gmailBody: 'Two signed prints. sent the items to the appraiser and will follow up.',
        lastMessageBody: 'sent the items to the appraiser and will follow up.',
        daysSinceLastMessage: 20,
      }),
    );

    expect(output.needsReview).toBeUndefined();
    expect(['standard', 'high']).toContain(output.priority);
  });
});

function input(overrides: Partial<Parameters<typeof import('../crmClassifier').classify>[0]> = {}) {
  return {
    boxKey: 'box-1',
    boxName: 'Estate lead',
    stageKey: 'new',
    stageName: 'New',
    gmailBody: 'A standard consignment email.',
    lastMessageBody: 'A standard consignment email.',
    lastMessageDate: new Date('2026-05-20T16:00:00.000Z').toISOString(),
    daysSinceLastMessage: 0,
    threadAgeDays: 0,
    senderEmail: 'sender@example.com',
    lastUpdatedMs: Date.now(),
    ...overrides,
  };
}

function mockGeminiJson(
  output: { department: string[]; priority: string; rationale?: string; model?: string },
  times = 1,
): void {
  for (let count = 0; count < times; count += 1) {
    geminiMocks.generateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            rationale: 'Mock rationale.',
            model: 'gemini-2.5-flash',
            ...output,
          }),
      },
    });
  }
}
