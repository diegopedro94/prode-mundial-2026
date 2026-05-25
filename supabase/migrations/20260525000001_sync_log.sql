-- =========================================================================
-- Sync log: tracks every api-football poll run for /admin/sync visibility.
-- =========================================================================

create table sync_log (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  fixtures_processed int not null default 0,
  fixtures_updated int not null default 0,
  requests_remaining int,
  error_message text
);
create index sync_log_started_at_idx on sync_log(started_at desc);

alter table sync_log enable row level security;

-- Only admins can read sync history. Inserts come from the GHA-driven script
-- using the service role key, which bypasses RLS anyway.
create policy "sync_log_admin_read" on sync_log
  for select to authenticated using (public.is_admin());
