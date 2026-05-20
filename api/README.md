# API Functions

## `POST /api/crm-poll`

Manual CRM v0.5 demo poller. Requires an active admin Supabase session bearer
token and runs server-side only on Vercel.

Required Vercel env vars:

```text
STREAK_API_KEY
STREAK_PIPELINE_KEY
GEMINI_API_KEY
GMAIL_OAUTH_CLIENT_ID
GMAIL_OAUTH_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
GMAIL_USER_EMAIL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Optional env vars:

```text
STREAK_CLOSED_STAGE_KEYS=stage_a,stage_b
STREAK_VIP_DOMAINS=example.com,vip-estates.com
```

`GMAIL_REFRESH_TOKEN` is read-only OAuth for the consign mailbox. The Gmail
service enforces a read-only verb allowlist (`messages.list`, `messages.get`)
for the demo.
