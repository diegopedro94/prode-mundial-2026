-- =========================================================================
-- Goals + get_top_scorers integration tests.
--
-- Verifies that the new `goals` table behaves correctly under RLS, that own
-- goals don't count, and that get_top_scorers ranks players by goal volume.
-- =========================================================================

\set ECHO none
\set ON_ERROR_STOP on

select '---- goals + top-scorers tests ----' as banner;

------------------------------------------------------------------------------
-- 1. get_top_scorers excludes players with zero goals
------------------------------------------------------------------------------
do $$
declare cnt int;
begin
  -- No goals seeded by db reset → empty table.
  select count(*) into cnt from get_top_scorers(50);
  assert cnt = 0, format('empty case: expected 0 rows, got %s', cnt);
end $$;
select '✓ 1. get_top_scorers: empty when no goals' as test;

------------------------------------------------------------------------------
-- 2. Inserting goals ranks players correctly
------------------------------------------------------------------------------
begin;
-- Grab three known players from different teams to score with.
do $$
declare
  m_id int;
  p1_id int; p1_team int;
  p2_id int; p2_team int;
  p3_id int; p3_team int;
  ranked record;
  expected_first int;
begin
  -- Pick first group match for the foreign keys.
  select id into m_id from matches order by scheduled_at limit 1;

  -- Three distinct players. After a fresh db:reset they all have
  -- is_in_official_roster=false (sync:rosters hasn't run) — that's fine for
  -- the ranking math; the function doesn't filter on official roster.
  select id, team_id into p1_id, p1_team from players order by id limit 1;
  select id, team_id into p2_id, p2_team from players where id > p1_id order by id limit 1;
  select id, team_id into p3_id, p3_team from players where id > p2_id order by id limit 1;

  -- p1 scores 3 (incl. 1 penalty), p2 scores 2, p3 scores 1 own-goal (shouldn't count)
  insert into goals (match_id, player_id, team_id, minute, is_penalty) values
    (m_id, p1_id, p1_team, 12, false),
    (m_id, p1_id, p1_team, 45, false),
    (m_id, p1_id, p1_team, 80, true),
    (m_id, p2_id, p2_team, 30, false),
    (m_id, p2_id, p2_team, 67, false);
  insert into goals (match_id, player_id, team_id, minute, is_own_goal) values
    (m_id, p3_id, p3_team, 50, true);

  -- p1 should rank first with 3 goals, p2 second with 2.
  select * into ranked from get_top_scorers(10) order by goals_count desc limit 1;
  expected_first := p1_id;
  assert ranked.player_id = expected_first,
    format('expected p1 (%s) on top, got %s', expected_first, ranked.player_id);
  assert ranked.goals_count = 3,
    format('expected 3 goals for p1, got %s', ranked.goals_count);

  -- p3 (own-goal only) should be absent.
  if exists (select 1 from get_top_scorers(50) where player_id = p3_id) then
    raise exception 'own-goal-only player should not appear in get_top_scorers';
  end if;
end $$;
select '✓ 2. goals → get_top_scorers ranks correctly, excludes own goals' as test;
rollback;

------------------------------------------------------------------------------
-- 3. RLS: goals readable by any authenticated user
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000050', 'reader@test', '{}'::jsonb);
-- Seed a goal as service role (this txn).
do $$
declare m_id int; p_id int; t_id int;
begin
  select id into m_id from matches order by scheduled_at limit 1;
  select id, team_id into p_id, t_id from players limit 1;
  insert into goals (match_id, player_id, team_id, minute) values
    (m_id, p_id, t_id, 15);
end $$;
-- Become the test user and try to read.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000050"}';
do $$
declare cnt int;
begin
  select count(*) into cnt from goals;
  assert cnt >= 1, format('RLS read denied: expected ≥1, got %s', cnt);
end $$;
reset role;
select '✓ 3. RLS: goals readable by authenticated' as test;
rollback;

------------------------------------------------------------------------------
-- 4. RLS: non-admin cannot INSERT goals
------------------------------------------------------------------------------
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000051', 'nonadmin@test', '{}'::jsonb);
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000051"}';
do $$
declare m_id int; p_id int; t_id int; was_inserted boolean := false;
begin
  -- Set local row as service role first to know what we're inserting against
  -- (but the actual insert below is as the non-admin authenticated user).
  perform set_config('role','postgres',true);
  select id into m_id from matches order by scheduled_at limit 1;
  select id, team_id into p_id, t_id from players limit 1;
  perform set_config('role','authenticated',true);

  begin
    insert into goals (match_id, player_id, team_id, minute) values (m_id, p_id, t_id, 5);
    was_inserted := true;
  exception when others then
    was_inserted := false;
  end;

  perform set_config('role','postgres',true);
  if was_inserted then
    -- RLS denial silently returns 0 rows; verify the row didn't survive.
    if exists (select 1 from goals where match_id = m_id and player_id = p_id and minute = 5) then
      raise exception 'RLS leak: non-admin inserted into goals';
    end if;
  end if;
end $$;
reset role;
select '✓ 4. RLS: non-admin blocked from inserting goals' as test;
rollback;

------------------------------------------------------------------------------
-- 5. Manual goal CRUD: admin can insert and the top-scorers table reflects
--    the change without re-running any sync.
------------------------------------------------------------------------------
begin;
do $$
declare
  m_id int;
  p_id int;
  t_id int;
  pre_count bigint;
  post_count bigint;
begin
  select id into m_id from matches order by scheduled_at limit 1;
  -- Use the first official player so the row reflects in the get_top_scorers
  -- result without further setup.
  update players set is_in_official_roster = true where id =
    (select id from players order by id limit 1);
  select id, team_id into p_id, t_id from players order by id limit 1;

  select coalesce(sum(goals_count), 0) into pre_count from get_top_scorers(50);

  -- Insert two normal goals + a penalty + an own goal (own goal should NOT
  -- show up in get_top_scorers).
  insert into goals (match_id, player_id, team_id, minute) values
    (m_id, p_id, t_id, 23),
    (m_id, p_id, t_id, 67);
  insert into goals (match_id, player_id, team_id, minute, is_penalty) values
    (m_id, p_id, t_id, 81, true);
  insert into goals (match_id, player_id, team_id, minute, is_own_goal) values
    (m_id, p_id, t_id, 90, true);

  select coalesce(sum(goals_count), 0) into post_count from get_top_scorers(50);
  assert post_count - pre_count = 3,
    format('expected 3 new goals counted (own-goal excluded), got %s', post_count - pre_count);

  -- Now delete the penalty — count should drop by 1
  delete from goals where match_id = m_id and minute = 81;
  select coalesce(sum(goals_count), 0) into post_count from get_top_scorers(50);
  assert post_count - pre_count = 2,
    format('after deleting penalty: expected 2 left, got %s', post_count - pre_count);
end $$;
select '✓ 5. manual goal insert/delete updates get_top_scorers' as test;
rollback;

------------------------------------------------------------------------------
-- 6. Deleting a match cascades to its goals (FK on delete cascade)
------------------------------------------------------------------------------
begin;
do $$
declare
  m_id int;
  p_id int;
  t_id int;
  cnt int;
begin
  select id into m_id from matches order by scheduled_at limit 1;
  select id, team_id into p_id, t_id from players limit 1;
  insert into goals (match_id, player_id, team_id, minute) values (m_id, p_id, t_id, 15);
  -- Cascade
  delete from matches where id = m_id;
  select count(*) into cnt from goals where match_id = m_id;
  assert cnt = 0, format('expected cascade to remove goals, %s left', cnt);
end $$;
select '✓ 6. delete cascade: removing a match wipes its goals' as test;
rollback;

select '---- all goals/top-scorers tests passed ----' as banner;
