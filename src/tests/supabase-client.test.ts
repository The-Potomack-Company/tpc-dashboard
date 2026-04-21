import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('supabase client', () => {
  const ORIGINAL_URL = import.meta.env.VITE_SUPABASE_URL;
  const ORIGINAL_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  type MutableEnv = { env: Record<string, string> };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env values after each test so other suites see a clean state.
    (import.meta as unknown as MutableEnv).env.VITE_SUPABASE_URL = ORIGINAL_URL ?? '';
    (import.meta as unknown as MutableEnv).env.VITE_SUPABASE_ANON_KEY = ORIGINAL_KEY ?? '';
  });

  it('throws when VITE_SUPABASE_URL is missing on first property access', async () => {
    (import.meta as unknown as MutableEnv).env.VITE_SUPABASE_URL = '';
    (import.meta as unknown as MutableEnv).env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    const { supabase } = await import('../lib/supabase');
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_URL is not set/);
  });

  it('throws when VITE_SUPABASE_ANON_KEY is missing on first property access', async () => {
    (import.meta as unknown as MutableEnv).env.VITE_SUPABASE_URL = 'https://abc.supabase.co';
    (import.meta as unknown as MutableEnv).env.VITE_SUPABASE_ANON_KEY = '';
    const { supabase } = await import('../lib/supabase');
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_ANON_KEY is not set/);
  });

  it('returns a real, memoized SupabaseClient when both env vars are set', async () => {
    (import.meta as unknown as MutableEnv).env.VITE_SUPABASE_URL = 'https://abc.supabase.co';
    (import.meta as unknown as MutableEnv).env.VITE_SUPABASE_ANON_KEY = 'anon-key';
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
