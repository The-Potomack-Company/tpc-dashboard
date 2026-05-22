import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getThreadContent } from './lib/crm/gmailApi.js';

export const maxDuration = 30;

const REQUIRED_ENV = [
  'GMAIL_OAUTH_CLIENT_ID',
  'GMAIL_OAUTH_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_USER_EMAIL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  json: (payload: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

type ApiDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: string; is_active: boolean };
        Insert: { id?: string; role?: string; is_active?: boolean };
        Update: { id?: string; role?: string; is_active?: boolean };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type AdminClient = SupabaseClient<ApiDatabase>;

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    return await handleRequest(req, res);
  } catch (error) {
    console.error('[gmail-attachment] unhandled error:', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Internal error: ${message}` });
  }
}

async function handleRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const missingEnv = REQUIRED_ENV.find((key) => !process.env[key]);
  if (missingEnv) {
    res.status(500).json({ error: `Missing required env var: ${missingEnv}` });
    return;
  }

  const threadId = readQueryParam(req, 'threadId');
  if (!threadId) {
    res.status(400).json({ error: 'Missing required query parameter: threadId' });
    return;
  }

  const admin: AdminClient = createClient<ApiDatabase>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const authToken = readBearerToken(req.headers.authorization);
  if (!authToken) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(authToken);
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid Authorization bearer token' });
    return;
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .single();
  if (profileError) {
    res.status(403).json({ error: 'Profile not authorized' });
    return;
  }
  if (profile?.role !== 'admin' || profile.is_active !== true) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  // Gate on crm_threads row existence. Without this an admin token could pull
  // attachments for any Gmail thread the consign@ mailbox can see, not just
  // the CRM-tracked ones. RLS doesn't protect us here because we're calling
  // Gmail directly with a server-side OAuth token, not via Supabase.
  const { data: threadRow, error: threadLookupError } = await admin
    .from('crm_threads' as never)
    .select('id')
    .eq('gmail_thread_id', threadId)
    .maybeSingle();
  if (threadLookupError) {
    res.status(500).json({ error: 'Failed to verify thread' });
    return;
  }
  if (!threadRow) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  // getThreadContent enforces the gmail.readonly verb allowlist internally
  // (messages.get, messages.attachments.get, threads.get only). No write
  // verbs reachable — preserves the CRM v0.5 read-only invariant per
  // [[feedback_crm_v05_readonly_invariant]].
  const content = await getThreadContent(threadId);
  res.status(200).json({
    images: content.images.map((img) => ({ mimeType: img.mimeType, data: img.data })),
  });
}

function readQueryParam(req: ApiRequest, key: string): string | null {
  const direct = req.query?.[key];
  if (typeof direct === 'string' && direct.length > 0) return direct;
  if (Array.isArray(direct) && typeof direct[0] === 'string') return direct[0];

  // Vercel sometimes hands the function the raw URL when req.query is unset.
  if (req.url) {
    try {
      const url = new URL(req.url, 'http://internal');
      const value = url.searchParams.get(key);
      if (value && value.length > 0) return value;
    } catch {
      // Fall through and return null below.
    }
  }
  return null;
}

function readBearerToken(value: string | string[] | undefined): string | null {
  const header = Array.isArray(value) ? value[0] : value;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
