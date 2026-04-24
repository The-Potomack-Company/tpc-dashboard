-- Admin-only SELECT for dashboard data tables.
create policy "Admins can view sales"
  on public.sales for select
  to authenticated
  using ( (select private.is_admin()) );

create policy "Admins can view sale_departments"
  on public.sale_departments for select
  to authenticated
  using ( (select private.is_admin()) );

create policy "Admins can view departments"
  on public.departments for select
  to authenticated
  using ( (select private.is_admin()) );

create policy "Admins can view scraper_runs"
  on public.scraper_runs for select
  to authenticated
  using ( (select private.is_admin()) );

-- saved_reports: per-user CRUD (admin-only access, own rows only)
create policy "Admins view own saved_reports"
  on public.saved_reports for select
  to authenticated
  using ( (select private.is_admin()) and user_id = (select auth.uid()) );

create policy "Admins insert own saved_reports"
  on public.saved_reports for insert
  to authenticated
  with check ( (select private.is_admin()) and user_id = (select auth.uid()) );

create policy "Admins update own saved_reports"
  on public.saved_reports for update
  to authenticated
  using ( (select private.is_admin()) and user_id = (select auth.uid()) )
  with check ( (select private.is_admin()) and user_id = (select auth.uid()) );

create policy "Admins delete own saved_reports"
  on public.saved_reports for delete
  to authenticated
  using ( (select private.is_admin()) and user_id = (select auth.uid()) );

-- NOTE: No INSERT/UPDATE/DELETE policies on sales/sale_departments/departments/scraper_runs.
-- With RLS enabled and no matching policy, authenticated users cannot write.
-- Service role bypasses RLS, so import scripts + scraper can write.
