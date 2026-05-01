// src/hooks/useSignedPhotoUrl.ts
// Phase 3 / D-08 / D-09 / D-10 / D-11 — per-photo signed URL with
// refetch-on-focus.
//
// Filter-scope class: per-row, lazy. Mounted only when an item row is
// expanded (D-09 — no eager mass signing). The override of
// refetchOnWindowFocus: true is what makes Success Criterion #5 work:
// a 2h tab-resume triggers visibilitychange → query is past staleTime
// (50min) → refetch fires → new URL returned BEFORE the user sees a 403.
//
// IMPORTANT: D-13 — never call this for upload_status='failed' photos.
// Caller gates via the `enabled` arg. Test invariant: when enabled=false,
// no createSignedUrl call is made.
//
// Source verified: src/main.tsx QueryClient defaults; ErrorState contract;
// Phase 2 useLiveFeed override pattern (src/hooks/extension/useLiveFeed.ts).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SignedPhotoUrlArgs {
  path: string | null | undefined;
  enabled?: boolean; // D-13: pass false for upload_status='failed' photos
}

export function useSignedPhotoUrl({ path, enabled = true }: SignedPhotoUrlArgs) {
  return useQuery({
    queryKey: ['signed-photo-url', path] as const,
    queryFn: async () => {
      if (!path) throw new Error('No path');
      const { data, error } = await supabase.storage
        .from('photos')
        .createSignedUrl(path, 3600); // D-11: TTL 3600s matches TPC App
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: enabled && !!path,
    staleTime: 50 * 60 * 1000, // D-11: 50min — refetch 10min before TTL expiry
    gcTime: 10 * 60 * 1000, // D-11: 10min cache after unmount
    refetchOnWindowFocus: true, // D-08: OVERRIDE global default (false)
    retry: 1, // D-11
  });
}
