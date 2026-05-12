import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 8 — RPC parameter shape verification.
//
// Every activity RPC that aggregates over users now accepts a
// `p_include_dev` boolean parameter. These tests assert that:
//   - the parameter is always present (NEVER omitted — leaving it off would
//     silently force the SQL default and create a behavioral divergence
//     between admin and dev callers depending on how their hooks are wired);
//   - admin callers (includeDev=false) hand the RPC `p_include_dev: false`;
//   - dev callers (includeDev=true) hand the RPC `p_include_dev: true`.
//
// Mocking the supabase client at the module boundary keeps this a pure
// contract test against services/activity/queries.ts (the layer that owns
// the RPC wiring).

const rpcMock = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import {
  fetchTodayKpis,
  fetchActiveSessions,
  fetchStuckItems,
  fetchAiStatusDistribution,
  fetchExportPipeline,
  fetchHouseSaleSplit,
  fetchFailedAiBreakdown,
} from './queries';

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: [], error: null });
});

const range = { from: new Date('2026-05-01T00:00:00Z'), to: new Date('2026-05-12T00:00:00Z') };

describe('fetchTodayKpis — p_include_dev', () => {
  it('admin (includeDev=false) sends p_include_dev: false', async () => {
    await fetchTodayKpis({ specialists: [], mode: 'all', includeDev: false });
    expect(rpcMock).toHaveBeenCalledWith('get_today_kpis', {
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: false,
    });
  });

  it('dev (includeDev=true) sends p_include_dev: true', async () => {
    await fetchTodayKpis({ specialists: [], mode: 'all', includeDev: true });
    expect(rpcMock).toHaveBeenCalledWith('get_today_kpis', {
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: true,
    });
  });
});

describe('fetchActiveSessions — p_include_dev', () => {
  it('admin sends p_include_dev: false', async () => {
    await fetchActiveSessions({ specialists: [], mode: 'all', includeDev: false });
    expect(rpcMock).toHaveBeenCalledWith('get_active_sessions', {
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: false,
    });
  });
});

describe('fetchStuckItems — p_include_dev', () => {
  it('admin sends p_include_dev: false', async () => {
    await fetchStuckItems({ specialists: [], mode: 'all', includeDev: false });
    expect(rpcMock).toHaveBeenCalledWith('get_stuck_items', {
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: false,
    });
  });
});

describe('fetchAiStatusDistribution — p_include_dev', () => {
  it('admin sends p_include_dev: false', async () => {
    await fetchAiStatusDistribution({
      from: range.from,
      to: range.to,
      specialists: [],
      mode: 'all',
      includeDev: false,
    });
    expect(rpcMock).toHaveBeenCalledWith('get_ai_status_distribution', {
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: false,
    });
  });
});

describe('fetchExportPipeline — p_include_dev', () => {
  it('admin sends p_include_dev: false', async () => {
    await fetchExportPipeline({
      from: range.from,
      to: range.to,
      specialists: [],
      mode: 'all',
      includeDev: false,
    });
    expect(rpcMock).toHaveBeenCalledWith('get_export_pipeline', {
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: false,
    });
  });
});

describe('fetchHouseSaleSplit — p_include_dev', () => {
  it('admin sends p_include_dev: false', async () => {
    await fetchHouseSaleSplit({
      from: range.from,
      to: range.to,
      specialists: [],
      mode: 'all',
      includeDev: false,
    });
    expect(rpcMock).toHaveBeenCalledWith('get_house_sale_split', {
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: false,
    });
  });
});

describe('fetchFailedAiBreakdown — p_include_dev', () => {
  it('admin sends p_include_dev: false', async () => {
    await fetchFailedAiBreakdown({
      from: range.from,
      to: range.to,
      specialists: [],
      mode: 'all',
      includeDev: false,
    });
    expect(rpcMock).toHaveBeenCalledWith('get_failed_ai_breakdown', {
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: false,
    });
  });

  it('dev sends p_include_dev: true', async () => {
    await fetchFailedAiBreakdown({
      from: range.from,
      to: range.to,
      specialists: [],
      mode: 'all',
      includeDev: true,
    });
    expect(rpcMock).toHaveBeenCalledWith('get_failed_ai_breakdown', {
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
      p_specialists: [],
      p_mode: 'all',
      p_include_dev: true,
    });
  });
});
