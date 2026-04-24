import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Vite inlines `import.meta.env.VITE_*` at transform time, so we can't mutate
// the object directly and expect the already-compiled supabase.ts module to
// pick up changes. `vi.stubEnv` is the Vitest-sanctioned way to override
// these values for a single test and properly resets with `vi.unstubAllEnvs`.
describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when VITE_SUPABASE_URL is missing on first property access', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    const { supabase } = await import('../lib/supabase');
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_URL is not set/);
  });

  it('throws when VITE_SUPABASE_ANON_KEY is missing on first property access', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { supabase } = await import('../lib/supabase');
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_ANON_KEY is not set/);
  });

  it('returns a real, memoized SupabaseClient when both env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    const { supabase } = await import('../lib/supabase');

    // Lazy instantiation succeeds on first access.
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe('function');

    // Memoized: two accesses return the exact same underlying property reference.
    const firstAuth = supabase.auth;
    const secondAuth = supabase.auth;
    expect(firstAuth).toBe(secondAuth);
  });
});
