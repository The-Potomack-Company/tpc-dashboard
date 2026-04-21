alter table public.sales
  add column validation_warning boolean not null default false;

comment on column public.sales.validation_warning is
  'True when cross-validation of dept sums vs sale-level totals exceeded tolerance during import. See Phase 2.';
