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

  it("forces priority='high' for VIP sender domain", async () => {
    const { classify } = await import('../crmClassifier');
    process.env.STREAK_VIP_DOMAINS = 'vip-estates.com';
    mockGeminiJson({ department: ['books'], priority: 'low' });

    const output = await classify(input({ senderEmail: 'agent@vip-estates.com', gmailBody: 'Book collection.' }));

    expect(output.priority).toBe('high');
  });

  it("forces priority='high' for explicit deadline within 7 days", async () => {
    const { classify } = await import('../crmClassifier');
    mockGeminiJson({ department: ['decarts'], priority: 'low' });

    const output = await classify(input({ gmailBody: 'We are moving and need a quote by 2026-05-23.' }));

    expect(output.priority).toBe('high');
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
});

function input(overrides: Partial<Parameters<typeof import('../crmClassifier').classify>[0]> = {}) {
  return {
    boxKey: 'box-1',
    boxName: 'Estate lead',
    stageKey: 'new',
    stageName: 'New',
    gmailBody: 'A standard consignment email.',
    senderEmail: 'sender@example.com',
    lastUpdatedMs: Date.now(),
    ...overrides,
  };
}

function mockGeminiJson(
  output: { department: string[]; priority: 'high' | 'standard' | 'low'; rationale?: string; model?: string },
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
