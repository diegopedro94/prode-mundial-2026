-- Credit a correct draw prediction even when the knockout went to penalties.
--
-- Before: the "2 pts for correct outcome" branch only fired on draws when
-- m.winner_team_id IS NULL. That holds for group-stage draws but never for
-- knockouts — even a 1-1 in regulation has winner_team_id set to the PK
-- winner (so the team that advances counts as the "winner"). A user who
-- correctly called "this match will end tied after 90'" got nothing for
-- that read; only the +1 PK bonus was available.
--
-- After: the draw branch keys off m.home_score = m.away_score (regulation
-- score) instead of winner_team_id. Group-stage behavior is unchanged
-- (regulation tied + winner null vs regulation tied + winner null), and
-- knockouts now credit "tied in regulation" predictions with the 2 pts.
-- The +1 PK bonus stays independent, so a draw-predictor who also nails
-- the shootout winner walks away with 3 pts.

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
     or (m.winner_team_id = m.home_team_id and p.home_score > p.away_score)
     or (m.winner_team_id = m.away_team_id and p.home_score < p.away_score) then
    base := 2;
  end if;

  if m.went_to_penalties and p.pk_winner_team_id is not null
     and p.pk_winner_team_id = m.pk_winner_team_id then
    pk_bonus := 1;
  end if;

  return base + pk_bonus;
end $$;
