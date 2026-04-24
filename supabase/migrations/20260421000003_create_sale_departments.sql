create table public.sale_departments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  department_id uuid not null references public.departments(id),
  department_code text not null,
  lots_auctioned integer,
  lots_sold integer,
  sell_through_pct numeric(5,2),
  total_sold_value numeric(14,2),
  low_estimate numeric(14,2),
  high_estimate numeric(14,2),
  reserves numeric(14,2),
  revenue numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sale_id, department_id)
);

create index idx_sale_departments_sale_id on public.sale_departments (sale_id);
create index idx_sale_departments_department_id on public.sale_departments (department_id);

alter table public.sale_departments enable row level security;

create trigger trg_sale_departments_updated_at
  before update on public.sale_departments
  for each row execute function public.set_updated_at();
