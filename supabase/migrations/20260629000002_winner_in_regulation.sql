-- "Ganador acertado" (2 pts) is evaluated against REGULATION, not against
-- the team that eventually advances. Penalties are scored separately via the
-- independent +1 bonus.
--
-- Before: the elsif used m.winner_team_id (which gets set to the PK winner
-- when a knockout goes to shootout). That meant a user who predicted
-- "PAR wins 1-2" in a match that ended 1-1 in regulation + PAR PK got 2 pts
-- for "ganador" — even though regulation was a draw and no team actually
-- won the regulation match. That double-counted: the bonus +1 for PK winner
-- was supposed to be the only credit for "they advanced via shootout".
--
-- After: the elsif looks at regulation score directly
-- (m.home_score vs m.away_score). winner_team_id is no longer consulted
-- here — it stays in the schema for standings, leaderboards, etc., but
-- doesn't drive scoring.

create or replace function public.calculate_match_points(p predictions, m matches)
returns smallint
language plpgsql
immutable
as $$
declare
  base smallint := 0;
  pk_bonus smallint := 0;
begin
  if p.home_score = m.home_score and p.away_score = m.away_score then
    base := 4;
  elsif (m.home_score = m.away_score and p.home_score = p.away_score)
     or (m.home_score > m.away_score and p.home_score > p.away_score)
     or (m.home_score < m.away_score and p.home_score < p.away_score) then
    base := 2;
  end if;

  if m.went_to_penalties and p.pk_winner_team_id is not null
     and p.pk_winner_team_id = m.pk_winner_team_id then
    pk_bonus := 1;
  end if;

  return base + pk_bonus;
end $$;
