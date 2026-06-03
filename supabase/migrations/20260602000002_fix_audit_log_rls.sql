-- =========================================================================
-- Fix: writing to matches.update raised RLS error on audit_log because
-- (a) the trigger ran as the invoker (no security definer), and
-- (b) audit_log had no INSERT policy — only SELECT was open to admins.
-- =========================================================================

-- 1) Make the trigger run with the function owner's privileges so it can
--    insert into audit_log regardless of the caller's RLS context. We still
--    record auth.uid() inside so the actor is preserved (uid() reads from
--    the session JWT, not from the function owner).
create or replace function public.audit_match_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (
    auth.uid(),
    'matches.update',
    'matches',
    new.id::text,
    to_jsonb(old),
    to_jsonb(new)
  );
  return new;
end $$;

-- 2) Allow admins to insert audit_log rows from the client (used by the
--    Lock Rosters action which stamps an audit_log entry explicitly).
create policy "audit_log_admin_insert" on audit_log
  for insert to authenticated with check (public.is_admin());
