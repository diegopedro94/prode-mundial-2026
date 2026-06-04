-- =========================================================================
-- Player full names: api-football's /players/squads only returns "T. Payne"
-- style short names, which makes surname/firstname searches in the special
-- combobox miss. /players/profiles?id=… exposes firstname/lastname; we cache
-- those here so we can index them in the search.
-- =========================================================================

alter table players
  add column if not exists firstname text,
  add column if not exists lastname text;

create index if not exists players_lastname_idx on players (lower(lastname));
