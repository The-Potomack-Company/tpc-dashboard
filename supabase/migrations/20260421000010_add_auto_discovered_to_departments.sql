alter table public.departments
  add column auto_discovered boolean not null default false;

comment on column public.departments.auto_discovered is
  'True when the row was inserted by the PDF importer because the code was not in the seed list. Eligible for display_name refinement.';
