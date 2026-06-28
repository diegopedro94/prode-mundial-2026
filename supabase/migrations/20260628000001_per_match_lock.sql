-- Per-match prediction lock.
--
-- Up to now, the predictions edit window was driven by `rounds.locks_at` alone:
-- a single timestamp per stage that gated every match in that stage. That
-- made sense for the group phase (all 72 matches lock at the first kickoff),
-- but knockouts in 2026 span multiple days and we want a finer policy:
--
--   * The first match of a round locks at its own kickoff so it can't be
--     edited mid-match.
--   * The rest of the bracket stays editable past the first kickoff (people
--     get to digest the first result and then commit) until the round-level
--     lock fires.
--
-- The fix is one tiny condition: a match's predictions lock at
-- MIN(rounds.locks_at, matches.scheduled_at). Adding `m.scheduled_at > now()`
-- to the existing EXISTS clause does exactly that — no new columns needed.
-- Group stage behavior is unchanged: rounds.group.locks_at was already set to
-- the first group kickoff, so the MIN collapses to that single value.

drop policy if exists "predictions_write_own_before_lock" on predictions;

create policy "predictions_write_own_before_lock" on predictions
  for all to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from matches m
      join rounds r on r.stage = m.stage
      where m.id = predictions.match_id
        and r.locks_at > now()
        and m.scheduled_at > now()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from matches m
      join rounds r on r.stage = m.stage
      where m.id = predictions.match_id
        and r.locks_at > now()
        and m.scheduled_at > now()
    )
  );
