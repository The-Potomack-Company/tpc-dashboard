create table public.scraper_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('pending','running','success','failure','partial')),
  sales_found integer default 0,
  sales_imported integer default 0,
  error_message text,
  logs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_scraper_runs_started_at on public.scraper_runs (started_at desc);
create index idx_scraper_runs_status on public.scraper_runs (status);

alter table public.scraper_runs enable row level security;

create trigger trg_scraper_runs_updated_at
  before update on public.scraper_runs
  for each row execute function public.set_updated_at();
