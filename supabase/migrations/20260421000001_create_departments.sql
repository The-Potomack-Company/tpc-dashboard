create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_departments_code on public.departments (code);

alter table public.departments enable row level security;

create trigger trg_departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();
