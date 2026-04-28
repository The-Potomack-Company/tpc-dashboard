// Phase 1 / 01-01 Task 5 remediation diagnostic.
// Enumerates distinct event_type values currently in public.analytics_events
// so the operator can choose between expanding the migration's CHECK enum
// or dropping CHECK altogether. Run-once script; safe to delete after use.
//
// Usage: `npx tsx --env-file=scraper/.env scripts/enumerate-event-types.ts`

import { getAdminClient } from '../scraper/lib/supabase-admin';

async function main() {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('analytics_events' as never)
    .select('event_type');
  if (error) {
    console.error('Query failed:', error);
    process.exit(1);
  }
  const counts = new Map<string, number>();
  for (const row of data as Array<{ event_type: string }>) {
    counts.set(row.event_type, (counts.get(row.event_type) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log('event_type            count');
  console.log('---                   ---');
  for (const [t, n] of sorted) {
    console.log(`${t.padEnd(22)}${n}`);
  }
  console.log(`---\ndistinct types: ${sorted.length}`);
  console.log(`total rows:     ${data.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
