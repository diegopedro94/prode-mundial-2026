-- =========================================================================
-- Group-stage flow integration tests.
--
-- Runs against the seeded local DB (48 teams + 72 group matches + 1 admin
-- email + 7 rounds). Each test wraps itself in BEGIN/ROLLBACK so the DB
-- stays clean for subsequent tests. A failing test raises an exception and
-- aborts the script with exit code != 0.
--
-- Run with:
--   docker exec -i supabase_db_prode-mundial-2026 \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/group-stage-flow.sql
-- =========================================================================

\set ECHO none
\set ON_ERROR_STOP on
\timing off

select '---- group-stage-flow tests ----' as banner;

-- A few constants shared across tests.
-- We pick the first 4 group-stage matches by scheduled_at (whichever they
-- are) so the tests don't depend on a specific draw.
create temp table tmp_t (
  match_id int,
  home_team_id int,
  away_team_id int
);
insert into tmp_t
select m.id, m.home_team_id, m.away_team_id
from matches m where m.stage = 'group'
order by m.scheduled_at limit 4;

------------------------------------------------------------------------------
-- 1. handle_new_user — creates profile, copies is_admin from allowed_emails
------------------------------------------------------------------------------
begin;
insert into allowed_emails (email, is_admin) values ('newadmin@test', true);
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000001', 'newadmin@test',
          '{"full_name":"New Admin"}'::jsonb);
do $$
declare p record;
begin
  select * into p from profiles
    where id = '00000000-0000-0000-0000-000000000001';
  assert p.display_name = 'New Admin', 'display_name not copied from metadata';
  assert p.is_admin is true, 'is_admin not copied from allowed_emails';
end $$;
select '✓ 1. handle_new_user copies display_name + is_admin' as test;
rollback;

------------------------------------------------------------------------------
-- 2. handle_new_user — non-admin email defaults to is_admin=false
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000002', 'random@gmail.com',
          '{"full_name":"Random Pibe"}'::jsonb);
do $$
declare p record;
begin
  select * into p from profiles
    where id = '00000000-0000-0000-0000-000000000002';
  assert p.is_admin is false, 'non-listed email should not be admin';
  assert p.display_name = 'Random Pibe', 'display_name not preserved';
end $$;
select '✓ 2. open registration: non-admin defaults to is_admin=false' as test;
rollback;

------------------------------------------------------------------------------
-- 3. calculate_match_points — exact score → 4 pts
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000003', 'u3@test', '{}'::jsonb);
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000003', match_id, 2, 1 from tmp_t limit 1;
update matches set home_score = 2, away_score = 1, status = 'finished',
                   winner_team_id = home_team_id
  where id = (select match_id from tmp_t limit 1);
do $$
declare pts smallint;
begin
  select points into pts from predictions
    where user_id = '00000000-0000-0000-0000-000000000003' limit 1;
  assert pts = 4, format('exact-score: expected 4 pts, got %s', pts);
end $$;
select '✓ 3. scoring: exact score → 4 pts' as test;
rollback;

------------------------------------------------------------------------------
-- 4. calculate_match_points — winner only → 2 pts
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000004', 'u4@test', '{}'::jsonb);
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000004', match_id, 2, 1 from tmp_t limit 1;
-- actual: home wins 3-0 (winner correct, score wrong)
update matches set home_score = 3, away_score = 0, status = 'finished',
                   winner_team_id = home_team_id
  where id = (select match_id from tmp_t limit 1);
do $$
declare pts smallint;
begin
  select points into pts from predictions
    where user_id = '00000000-0000-0000-0000-000000000004' limit 1;
  assert pts = 2, format('winner-only: expected 2 pts, got %s', pts);
end $$;
select '✓ 4. scoring: winner only → 2 pts' as test;
rollback;

------------------------------------------------------------------------------
-- 5. calculate_match_points — wrong winner → 0 pts
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000005', 'u5@test', '{}'::jsonb);
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000005', match_id, 2, 1 from tmp_t limit 1;
update matches set home_score = 0, away_score = 2, status = 'finished',
                   winner_team_id = away_team_id
  where id = (select match_id from tmp_t limit 1);
do $$
declare pts smallint;
begin
  select points into pts from predictions
    where user_id = '00000000-0000-0000-0000-000000000005' limit 1;
  assert pts = 0, format('wrong-winner: expected 0 pts, got %s', pts);
end $$;
select '✓ 5. scoring: wrong winner → 0 pts' as test;
rollback;

------------------------------------------------------------------------------
-- 6. calculate_match_points — predicted tie / actual tie → 2 pts
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000006', 'u6@test', '{}'::jsonb);
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000006', match_id, 1, 1 from tmp_t limit 1;
update matches set home_score = 0, away_score = 0, status = 'finished',
                   winner_team_id = null
  where id = (select match_id from tmp_t limit 1);
do $$
declare pts smallint;
begin
  select points into pts from predictions
    where user_id = '00000000-0000-0000-0000-000000000006' limit 1;
  assert pts = 2,
    format('predicted-tie/actual-tie: expected 2 pts, got %s', pts);
end $$;
select '✓ 6. scoring: predicted tie + actual tie → 2 pts' as test;
rollback;

------------------------------------------------------------------------------
-- 7. calculate_match_points — exact tie (2-2) → 4 pts (not just 2)
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000007', 'u7@test', '{}'::jsonb);
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000007', match_id, 2, 2 from tmp_t limit 1;
update matches set home_score = 2, away_score = 2, status = 'finished',
                   winner_team_id = null
  where id = (select match_id from tmp_t limit 1);
do $$
declare pts smallint;
begin
  select points into pts from predictions
    where user_id = '00000000-0000-0000-0000-000000000007' limit 1;
  assert pts = 4, format('exact-tie: expected 4 pts, got %s', pts);
end $$;
select '✓ 7. scoring: exact tie → 4 pts (beats winner-only)' as test;
rollback;

------------------------------------------------------------------------------
-- 8. recalc_predictions_for_match — fires on score change after finished
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000008', 'u8@test', '{}'::jsonb);
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000008', match_id, 1, 0 from tmp_t limit 1;
-- first mark finished with the "wrong" score → user gets 0
update matches set home_score = 0, away_score = 2, status = 'finished',
                   winner_team_id = away_team_id
  where id = (select match_id from tmp_t limit 1);
do $$
declare pts smallint;
begin
  select points into pts from predictions
    where user_id = '00000000-0000-0000-0000-000000000008' limit 1;
  assert pts = 0, format('after first finalize: expected 0, got %s', pts);
end $$;
-- admin fixes the score later (also flipping winner) → trigger must recalc
update matches set home_score = 1, away_score = 0, winner_team_id = home_team_id
  where id = (select match_id from tmp_t limit 1);
do $$
declare pts smallint;
begin
  select points into pts from predictions
    where user_id = '00000000-0000-0000-0000-000000000008' limit 1;
  assert pts = 4, format('after correction: expected 4, got %s', pts);
end $$;
select '✓ 8. recalc trigger fires on post-finished score change' as test;
rollback;

------------------------------------------------------------------------------
-- 9. audit_log — captures every matches.update
------------------------------------------------------------------------------
begin;
update matches set home_score = 7, away_score = 7
  where id = (select match_id from tmp_t limit 1);
do $$
declare cnt int;
begin
  select count(*) into cnt from audit_log
    where action = 'matches.update'
      and entity_id = (select match_id::text from tmp_t limit 1);
  assert cnt >= 1, format('expected ≥1 audit row, got %s', cnt);
end $$;
select '✓ 9. audit_log captures matches.update' as test;
rollback;

------------------------------------------------------------------------------
-- 10. get_leaderboard — sums points + counts exactos correctly
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000010', 'leader10@test', '{"full_name":"Leader A"}'::jsonb),
  ('00000000-0000-0000-0000-000000000011', 'leader11@test', '{"full_name":"Leader B"}'::jsonb);

-- Player A: 2 exactos = 8 pts
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000010', match_id, 2, 1
  from tmp_t order by match_id limit 2;
-- Player B: 1 exacto + 1 winner-only = 6 pts
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000011', match_id, 2, 1
  from tmp_t order by match_id limit 1;
insert into predictions (user_id, match_id, home_score, away_score)
  select '00000000-0000-0000-0000-000000000011', match_id, 3, 0
  from tmp_t order by match_id offset 1 limit 1;

-- Finish both matches 2-1, home wins
update matches set home_score = 2, away_score = 1, status = 'finished',
                   winner_team_id = home_team_id
  where id in (select match_id from tmp_t order by match_id limit 2);

do $$
declare ra record; rb record;
begin
  select * into ra from get_leaderboard()
    where user_id = '00000000-0000-0000-0000-000000000010';
  select * into rb from get_leaderboard()
    where user_id = '00000000-0000-0000-0000-000000000011';
  assert ra.total_points = 8, format('A: expected 8 pts, got %s', ra.total_points);
  assert ra.exact_count = 2, format('A: expected 2 exactos, got %s', ra.exact_count);
  assert rb.total_points = 6, format('B: expected 6 pts, got %s', rb.total_points);
  assert rb.exact_count = 1, format('B: expected 1 exacto, got %s', rb.exact_count);
end $$;
select '✓ 10. get_leaderboard aggregates points/exactos correctly' as test;
rollback;

------------------------------------------------------------------------------
-- 11. RLS — pre-kickoff: user can NOT read someone else's prediction
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000020', 'alice@test', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000021', 'bob@test', '{}'::jsonb);
-- Pick a match scheduled in the future (any group match will do for this).
insert into predictions (user_id, match_id, home_score, away_score)
  values ('00000000-0000-0000-0000-000000000020',
          (select match_id from tmp_t limit 1), 2, 1);
-- Become Bob and try to read Alice's prediction.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000021"}';
do $$
declare visible int;
begin
  select count(*) into visible from predictions
    where user_id = '00000000-0000-0000-0000-000000000020';
  assert visible = 0,
    format('RLS leak: Bob saw %s of Alice''s predictions pre-kickoff', visible);
end $$;
reset role;
select '✓ 11. RLS hides others'' predictions pre-kickoff' as test;
rollback;

------------------------------------------------------------------------------
-- 12. RLS — post-kickoff: user CAN read someone else's prediction
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000030', 'alice2@test', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000031', 'bob2@test', '{}'::jsonb);
-- Force a match into the past so the reveal RLS engages.
update matches set scheduled_at = now() - interval '1 hour'
  where id = (select match_id from tmp_t limit 1);
insert into predictions (user_id, match_id, home_score, away_score)
  values ('00000000-0000-0000-0000-000000000030',
          (select match_id from tmp_t limit 1), 2, 1);
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000031"}';
do $$
declare visible int;
begin
  select count(*) into visible from predictions
    where user_id = '00000000-0000-0000-0000-000000000030';
  assert visible = 1,
    format('RLS reveal failed: expected 1, got %s', visible);
end $$;
reset role;
select '✓ 12. RLS reveals others'' predictions after kickoff' as test;
rollback;

------------------------------------------------------------------------------
-- 13. RLS — after the round lock fires, INSERT/UPDATE is blocked
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000040', 'locked@test', '{}'::jsonb);
-- Move the group lock into the past.
update rounds set locks_at = now() - interval '1 minute' where stage = 'group';
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000040"}';
do $$
declare denied boolean := false;
begin
  begin
    insert into predictions (user_id, match_id, home_score, away_score)
      values ('00000000-0000-0000-0000-000000000040',
              (select match_id from tmp_t limit 1), 1, 0);
  exception when others then
    denied := true;
  end;
  -- A clean RLS denial returns 0 rows affected (no error). Check the row
  -- didn't actually land.
  if not denied then
    if exists (select 1 from predictions
               where user_id = '00000000-0000-0000-0000-000000000040') then
      raise exception 'RLS leak: write went through after round lock';
    end if;
  end if;
end $$;
reset role;
select '✓ 13. RLS blocks predictions after round lock' as test;
rollback;

------------------------------------------------------------------------------
-- 14. Seed sanity — 48 teams in 12 groups, 72 group matches
------------------------------------------------------------------------------
do $$
declare cnt_teams int; cnt_groups int; cnt_matches int;
begin
  select count(*) into cnt_teams from teams;
  select count(distinct group_letter) into cnt_groups from teams
    where group_letter is not null;
  select count(*) into cnt_matches from matches where stage = 'group';
  assert cnt_teams = 48, format('expected 48 teams, got %s', cnt_teams);
  assert cnt_groups = 12, format('expected 12 groups, got %s', cnt_groups);
  assert cnt_matches = 72, format('expected 72 group matches, got %s', cnt_matches);
end $$;
select '✓ 14. seed integrity: 48 teams / 12 groups / 72 matches' as test;

------------------------------------------------------------------------------
-- 15. Seed sanity — rounds table has all 7 stages
------------------------------------------------------------------------------
do $$
declare cnt int;
begin
  select count(distinct stage) into cnt from rounds;
  assert cnt = 7, format('expected 7 rounds, got %s', cnt);
end $$;
select '✓ 15. seed integrity: rounds covers all 7 stages' as test;

select '---- all group-stage tests passed ----' as banner;
