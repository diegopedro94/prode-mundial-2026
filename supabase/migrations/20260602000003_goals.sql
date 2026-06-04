-- =========================================================================
-- Goleadores: one row per goal scored in a match. Powers:
--   * top-scorer leaderboard (special prediction resolution at the end)
--   * potential future per-match goal lists, "did Messi score?" widgets, etc.
-- =========================================================================

create table goals (
  id bigserial primary key,
  match_id int not null references matches(id) on delete cascade,
  player_id int not null references players(id) on delete cascade,
  team_id int not null references teams(id),
  minute int,
  is_penalty boolean not null default false,
  is_own_goal boolean not null default false,
  created_at timestamptz not null default now()
);

create index goals_match_id_idx on goals(match_id);
create index goals_player_id_idx on goals(player_id);
create index goals_team_id_idx on goals(team_id);

alter table goals enable row level security;

-- Same RLS as teams/players/matches: every authenticated user can read; only
-- admin (and the sync via service role) writes.
create policy "goals_read_authenticated" on goals
  for select to authenticated using (true);

create policy "goals_admin_write" on goals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- get_top_scorers — used by /admin/top-scorers (and later by the special-
-- prediction resolution at tournament end).
-- ---------------------------------------------------------------------------
create or replace function public.get_top_scorers(limit_count int default 50)
returns table (
  player_id int,
  player_name text,
  player_position player_position,
  team_id int,
  team_name text,
  team_fifa_code text,
  team_flag_url text,
  goals_count bigint,
  is_in_official_roster boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as player_id,
    p.name as player_name,
    p.position as player_position,
    t.id as team_id,
    t.name as team_name,
    t.fifa_code as team_fifa_code,
    t.flag_url as team_flag_url,
    count(g.id)::bigint as goals_count,
    p.is_in_official_roster
  from public.players p
  join public.teams t on t.id = p.team_id
  join public.goals g on g.player_id = p.id and not g.is_own_goal
  group by p.id, p.name, p.position, t.id, t.name, t.fifa_code, t.flag_url,
           p.is_in_official_roster
  order by goals_count desc, p.name
  limit limit_count;
$$;

grant execute on function public.get_top_scorers(int) to authenticated;
