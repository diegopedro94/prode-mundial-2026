-- Per-match lock override.
--
-- Round-level `rounds.locks_at` is fine when every match in a stage should
-- lock at the same moment (all groups, most knockout rounds). But we ran
-- into an R16 case where the first two matches share one deadline and the
-- rest share a different, later one. Splitting via a single round.locks_at
-- can't express that.
--
-- Add a nullable `matches.locks_at` and teach the write policy to prefer it
-- when present, falling back to the round-level value. The MIN() with
-- scheduled_at stays so a match can never be edited after it kicks off,
-- regardless of what's in the lock columns.

alter table matches add column if not exists locks_at timestamptz;

drop policy if exists "predictions_write_own_before_lock" on predictions;

create policy "predictions_write_own_before_lock" on predictions
  for all to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from matches m
      join rounds r on r.stage = m.stage
      where m.id = predictions.match_id
        and coalesce(m.locks_at, r.locks_at) > now()
        and m.scheduled_at > now()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from matches m
      join rounds r on r.stage = m.stage
      where m.id = predictions.match_id
        and coalesce(m.locks_at, r.locks_at) > now()
        and m.scheduled_at > now()
    )
  );
