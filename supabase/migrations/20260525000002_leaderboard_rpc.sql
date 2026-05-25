-- =========================================================================
-- Leaderboard: aggregate function callable by any authenticated user.
-- =========================================================================
--
-- Why SECURITY DEFINER:
-- The RLS on `predictions` only exposes other users' rows after kickoff.
-- For the leaderboard we want the *aggregate* (total points, exact count)
-- across every user — and that doesn't leak individual prediction values
-- (only sums and counts). SECURITY DEFINER bypasses RLS for the aggregation
-- so a user always sees the current standing even before the first match.

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
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.display_name,
    p.avatar_url,
    coalesce(sum(pr.points), 0)::bigint as total_points,
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
  group by p.id, p.display_name, p.avatar_url
  order by total_points desc, exact_count desc, p.display_name;
$$;

grant execute on function public.get_leaderboard() to authenticated;
