create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  title text not null,
  sale_date date,
  lots_auctioned integer,
  lots_sold integer,
  lots_unsold integer,
  total_sold_value numeric(14,2),
  total_unsold_value numeric(14,2),
  total_low_estimate numeric(14,2),
  total_high_estimate numeric(14,2),
  total_reserves numeric(14,2),
  hammer_total numeric(14,2),
  buyer_premium numeric(14,2),
  seller_commission numeric(14,2),
  insurance numeric(14,2),
  lot_charges numeric(14,2),
  referral_fees numeric(14,2),
  net_revenue numeric(14,2),
  registered_bidders integer,
  winning_buyers integer,
  payment_status text,
  source_pdf_path text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sales_sale_date on public.sales (sale_date);
create index idx_sales_sale_number on public.sales (sale_number);

alter table public.sales enable row level security;

create trigger trg_sales_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();
