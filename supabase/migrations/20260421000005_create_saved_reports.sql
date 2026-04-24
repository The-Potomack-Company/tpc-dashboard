create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  report_type text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_saved_reports_user_id on public.saved_reports (user_id);

alter table public.saved_reports enable row level security;

create trigger trg_saved_reports_updated_at
  before update on public.saved_reports
  for each row execute function public.set_updated_at();
