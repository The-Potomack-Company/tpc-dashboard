import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Note: tests run under `cd scraper && npm run test` (scraper's own Vitest).
// They do NOT run as part of the root `npm test` (root Vitest has two
// projects — src and scripts — neither of which matches `scraper/**/*.test.ts`).

describe('getAdminClient', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset the memoised instance by re-importing the module fresh.
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when SUPABASE_URL is missing (mentions scraper/.env)', async () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    const mod = await import('./supabase-admin');
    expect(() => mod.getAdminClient()).toThrow(/SUPABASE_URL/);
    expect(() => mod.getAdminClient()).toThrow(/scraper\/\.env/);
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing (mentions Supabase Dashboard)', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mod = await import('./supabase-admin');
    expect(() => mod.getAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => mod.getAdminClient()).toThrow(/Supabase Dashboard/);
  });

  it('returns a truthy client when both env vars are set', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    const mod = await import('./supabase-admin');
    const client = mod.getAdminClient();
    expect(client).toBeTruthy();
    expect(typeof client.from).toBe('function');
  });

  it('memoises — returns the same instance on repeated calls', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    const mod = await import('./supabase-admin');
    const c1 = mod.getAdminClient();
    const c2 = mod.getAdminClient();
    expect(c1).toBe(c2);
  });
});
