-- Final tournament outcomes:
--   * Champion:     Spain (id 8)
--   * Runner-up:    Argentina (id 20)
--   * Top scorer:   Kylian Mbappé (id 498)
--   * MVP:          Rodri (id 1175)
--   * Best GK:      Unai Simón (id 1161)
--
-- Two changes so those scores show up in the leaderboard:
--   1. Update special_predictions.points for every row using the actuals.
--   2. Extend get_leaderboard() to fold sp.points into total_points. The
--      original RPC only summed predictions.points, so the specials were
--      stored but not visible on the standings page.

update special_predictions
   set points = (case when champion_team_id      = 8    then 4 else 0 end)
              + (case when runner_up_team_id     = 20   then 3 else 0 end)
              + (case when top_scorer_player_id  = 498  then 3 else 0 end)
              + (case when mvp_player_id         = 1175 then 3 else 0 end)
              + (case when best_gk_player_id     = 1161 then 1 else 0 end);

create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points bigint,
  exact_count bigint,
  scored_count bigint,
  predictions_count bigint
)
language sql
stable
as $$
  select
    p.id as user_id,
    p.display_name,
    p.avatar_url,
    (coalesce(sum(pr.points), 0) + coalesce(max(sp.points), 0))::bigint as total_points,
    count(*) filter (
      where m.status = 'finished'
        and pr.home_score = m.home_score
        and pr.away_score = m.away_score
    )::bigint as exact_count,
    count(*) filter (
      where m.status = 'finished'
        and pr.points > 0
    )::bigint as scored_count,
    count(*) filter (
      where pr.match_id is not null
    )::bigint as predictions_count
  from public.profiles p
  left join public.predictions pr on pr.user_id = p.id
  left join public.matches m on m.id = pr.match_id
  left join public.special_predictions sp on sp.user_id = p.id
  group by p.id, p.display_name, p.avatar_url
  order by total_points desc, exact_count desc, p.display_name;
$$;
