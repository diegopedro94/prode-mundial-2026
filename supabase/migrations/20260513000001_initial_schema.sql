-- =========================================================================
-- Prode Mundial 2026 — initial schema, RLS, scoring functions and triggers.
-- =========================================================================
--
-- Conventions:
--   * RLS is the source of truth for reveal and lock rules. Do not mirror in TS.
--   * Match scoring is computed by `calculate_match_points` and applied by the
--     `recalc_predictions_for_match` trigger when a match flips to 'finished'
--     or when the recorded result changes.
--   * Every UPDATE on `matches` is appended to `audit_log` (actor_id = null
--     when the change comes from the service role, e.g. the api-football sync).

-- -------------------------------------------------------------------------
-- 1. ENUMS
-- -------------------------------------------------------------------------
create type tournament_stage as enum (
  'group', 'r32', 'r16', 'qf', 'sf', 'third_place', 'final'
);
create type match_status as enum ('scheduled', 'live', 'finished');
create type player_position as enum ('GK', 'DEF', 'MID', 'FWD');

-- -------------------------------------------------------------------------
-- 2. TABLES
-- -------------------------------------------------------------------------

-- Email allowlist consulted by the auth-users insert trigger.
-- `is_admin` is propagated to profiles on first signup.
create table allowed_emails (
  email text primary key,
  is_admin boolean not null default false,
  added_at timestamptz not null default now(),
  added_by uuid
);

-- Public-facing user record. Auto-populated by handle_new_user().
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Backfill the added_by FK now that profiles exists.
alter table allowed_emails
  add constraint allowed_emails_added_by_fkey
  foreign key (added_by) references profiles(id) on delete set null;

create table teams (
  id serial primary key,
  external_id int unique,
  name text not null,
  fifa_code text not null unique,
  group_letter char(1),
  flag_url text
);

create table players (
  id serial primary key,
  external_id int unique,
  team_id int not null references teams(id),
  name text not null,
  position player_position,
  jersey_number int,
  is_in_official_roster boolean not null default false
);
create index players_team_id_idx on players(team_id);
create index players_official_roster_idx on players(is_in_official_roster) where is_in_official_roster;

create table rounds (
  stage tournament_stage primary key,
  locks_at timestamptz not null
);

create table matches (
  id serial primary key,
  external_id int unique,
  stage tournament_stage not null,
  group_letter char(1),
  home_team_id int references teams(id),
  away_team_id int references teams(id),
  scheduled_at timestamptz not null,
  status match_status not null default 'scheduled',
  home_score smallint,
  away_score smallint,
  went_to_penalties boolean not null default false,
  pk_winner_team_id int references teams(id),
  winner_team_id int references teams(id),
  updated_at timestamptz default now()
);
create index matches_scheduled_at_idx on matches(scheduled_at);
create index matches_stage_idx on matches(stage);

create table predictions (
  user_id uuid references profiles(id) on delete cascade,
  match_id int references matches(id) on delete cascade,
  home_score smallint not null,
  away_score smallint not null,
  pk_winner_team_id int references teams(id),
  points smallint,
  updated_at timestamptz default now(),
  primary key (user_id, match_id)
);
create index predictions_match_id_idx on predictions(match_id);

create table special_predictions (
  user_id uuid primary key references profiles(id) on delete cascade,
  champion_team_id int references teams(id),
  runner_up_team_id int references teams(id),
  top_scorer_player_id int references players(id),
  mvp_player_id int references players(id),
  best_gk_player_id int references players(id),
  points smallint not null default 0,
  updated_at timestamptz default now()
);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  entity text,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);
create index audit_log_created_at_idx on audit_log(created_at desc);

-- -------------------------------------------------------------------------
-- 3. FUNCTIONS & TRIGGERS
-- -------------------------------------------------------------------------

-- Reject signups whose email is not whitelisted.
create or replace function public.enforce_email_whitelist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_emails ae where lower(ae.email) = lower(new.email)
  ) then
    raise exception 'Email % is not authorized for this prode', new.email
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trg_auth_users_email_whitelist
  before insert on auth.users
  for each row execute function public.enforce_email_whitelist();

-- Create profiles row + copy is_admin from allowed_emails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_display text;
begin
  select ae.is_admin into v_is_admin
    from public.allowed_emails ae
    where lower(ae.email) = lower(new.email);

  v_display := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, avatar_url, is_admin)
  values (
    new.id,
    v_display,
    new.raw_user_meta_data->>'avatar_url',
    coalesce(v_is_admin, false)
  );
  return new;
end $$;

create trigger trg_auth_users_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Match scoring (spec §8). Pure function over (prediction, match).
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
  elsif (m.winner_team_id is null and p.home_score = p.away_score)
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

-- Recalc points for all predictions of a match when it finishes or its
-- recorded result changes.
create or replace function public.recalc_predictions_for_match()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'finished'
     and (old.status is distinct from 'finished'
          or new.home_score is distinct from old.home_score
          or new.away_score is distinct from old.away_score
          or new.went_to_penalties is distinct from old.went_to_penalties
          or new.pk_winner_team_id is distinct from old.pk_winner_team_id
          or new.winner_team_id is distinct from old.winner_team_id) then
    update predictions p
      set points = public.calculate_match_points(p, new)
      where p.match_id = new.id;
  end if;
  return new;
end $$;

create trigger trg_recalc_predictions
  after update on matches
  for each row execute function public.recalc_predictions_for_match();

-- Audit every UPDATE on matches. Service role updates land with actor=null.
create or replace function public.audit_match_changes()
returns trigger
language plpgsql
as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (
    auth.uid(),
    'matches.update',
    'matches',
    new.id::text,
    to_jsonb(old),
    to_jsonb(new)
  );
  return new;
end $$;

create trigger trg_audit_matches
  after update on matches
  for each row execute function public.audit_match_changes();

-- Touch updated_at on relevant tables.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_predictions_touch
  before update on predictions
  for each row execute function public.touch_updated_at();

create trigger trg_special_predictions_touch
  before update on special_predictions
  for each row execute function public.touch_updated_at();

create trigger trg_matches_touch
  before update on matches
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------------------
-- 4. RLS
-- -------------------------------------------------------------------------

alter table allowed_emails enable row level security;
alter table profiles enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table special_predictions enable row level security;
alter table audit_log enable row level security;

-- Helper: is the current caller an admin?
-- SECURITY DEFINER so the profiles read isn't blocked by the same RLS we'd
-- otherwise depend on while evaluating other policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- allowed_emails: admin-only
create policy "allowed_emails_admin_all" on allowed_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: everyone authed reads. Each user updates own row except is_admin.
-- Admin can update anyone (including is_admin).
create policy "profiles_read_authenticated" on profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from profiles p where p.id = auth.uid()));

create policy "profiles_admin_all" on profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- teams / players / rounds / matches: authed reads, admin writes.
create policy "teams_read_authenticated" on teams
  for select to authenticated using (true);
create policy "teams_admin_write" on teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "players_read_authenticated" on players
  for select to authenticated using (true);
create policy "players_admin_write" on players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "rounds_read_authenticated" on rounds
  for select to authenticated using (true);
create policy "rounds_admin_write" on rounds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "matches_read_authenticated" on matches
  for select to authenticated using (true);
create policy "matches_admin_write" on matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- predictions: spec §7.
create policy "predictions_read_own" on predictions
  for select to authenticated using (auth.uid() = user_id);

create policy "predictions_read_others_after_kickoff" on predictions
  for select to authenticated using (
    exists (
      select 1 from matches m
      where m.id = predictions.match_id and m.scheduled_at <= now()
    )
  );

create policy "predictions_write_own_before_lock" on predictions
  for all to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from matches m
      join rounds r on r.stage = m.stage
      where m.id = predictions.match_id and r.locks_at > now()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from matches m
      join rounds r on r.stage = m.stage
      where m.id = predictions.match_id and r.locks_at > now()
    )
  );

create policy "predictions_admin_all" on predictions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- special_predictions: spec §7, opción A (visible tras 1er partido).
create policy "special_read_own" on special_predictions
  for select to authenticated using (auth.uid() = user_id);

create policy "special_read_others_after_wc_starts" on special_predictions
  for select to authenticated using (
    (select min(scheduled_at) from matches) <= now()
  );

create policy "special_write_own_before_wc_starts" on special_predictions
  for all to authenticated
  using (
    auth.uid() = user_id
    and (select min(scheduled_at) from matches) > now()
  )
  with check (
    auth.uid() = user_id
    and (select min(scheduled_at) from matches) > now()
  );

create policy "special_admin_all" on special_predictions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- audit_log: read admin-only. Inserts only via triggers (no client policy).
create policy "audit_log_admin_read" on audit_log
  for select to authenticated using (public.is_admin());
