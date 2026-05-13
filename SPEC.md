# Prode Mundial 2026 — Spec

App de prode para Mundial 2026 (USA/Canadá/México, 11 jun – 19 jul). Grupo cerrado de amigos, leaderboard global único, no hay plata de por medio.

---

## 1. Roles

- **Participante**: carga predicciones, ve el leaderboard, ve predicciones de otros solo según reglas de reveal.
- **Admin (Consejo del Prode)**: carga/edita resultados, lockea rosters, configura deadlines de rondas, supervisa sync con API.

---

## 2. Reglas del juego

### 2.1 Tipos de predicción

**Por partido (104 partidos: 72 grupos + 32 eliminatorias):**
- Score exacto (home_score, away_score).
- Solo eliminatorias: si el usuario predice que hay penales, también elige ganador del shootout.

**Especiales (1 set por usuario):**
- Campeón
- Subcampeón
- Goleador del torneo
- MVP
- Mejor arquero

### 2.2 Scoring de partidos

| Caso | Puntos |
|---|---|
| Score exacto | 4 |
| Solo ganador correcto (incluye predecir empate cuando hubo empate, sin acertar score) | 2 |
| Erró | 0 |
| Bonus: acertó ganador de penales en eliminatoria (independiente del resultado base) | +1 |

Ejemplo en eliminatoria: predijo 1-0 Argentina, terminó 1-1 y ganó Argentina por penales que también predijo. Resultado: 0 (base) + 1 (penales) = **1 punto**.

### 2.3 Scoring de especiales (se resuelve al final del torneo)

| Predicción | Puntos |
|---|---|
| Campeón | 4 |
| Subcampeón | 3 |
| Goleador | 3 |
| MVP | 3 |
| Mejor arquero | 1 |

### 2.4 Desempate del leaderboard

1. Cantidad total de **scores exactos** acertados.
2. (TBD si se necesita un segundo criterio — definir si hay empate en final.)

---

## 3. Deadlines y locks

### 3.1 Fase de grupos + especiales
Lock único en el **kickoff del primer partido del Mundial** (11 jun 2026).
- Antes: editable libre, auto-save.
- Después: read-only para siempre.

### 3.2 Eliminatorias — lock por ronda
Cada ronda lockea en el kickoff del primer partido de esa ronda. Antes de ese momento, el participante carga todos los partidos de la ronda.

Rondas (formato 2026, 48 equipos):
1. **R32** — Ronda de 32 (8 mejores terceros + top 2 de cada grupo)
2. **R16** — Octavos
3. **QF** — Cuartos
4. **SF** — Semis
5. **3rd** — Tercer puesto
6. **Final**

Los equipos de cada ronda solo se conocen al cerrar la ronda anterior. La vista de carga se desbloquea cuando el admin (o el sync de la API) completa el bracket de esa ronda.

### 3.3 Roster oficial (afecta especiales)
Los selectores de Goleador / MVP / Mejor Arquero se llenan desde la lista de jugadores del roster oficial publicado para el 1er partido del Mundial. Acción admin: **"Lock rosters"** congela `players.is_in_official_roster = true`. Después de eso, esos selectores quedan inmutables como conjunto.

---

## 4. Reveal de predicciones

| Qué | Cuándo se revela al resto |
|---|---|
| Predicción de un partido | Al kickoff de ese partido |
| Predicciones especiales | Al kickoff del primer partido del Mundial (Opción A) |
| Tu propio prode | Siempre visible para vos |
| Todo | Siempre visible para admin |

Implementación: vive en RLS de Postgres, no en lógica de aplicación.

---

## 5. Fuente de resultados

**Primaria:** [api-football](https://www.api-football.com) (api-sports.io), `league=1`, `season=2026`.
- Plan free (100 req/day) alcanza: ~104 partidos × ~5 polls cada uno = ~500 calls totales en 39 días, pero distribuidos.
- Endpoints clave: `/fixtures`, `/players/topscorers`, `/players/squads`, `/standings`.

**Estrategia de sync:**
- Cron que pollea solo durante ventanas de partidos activos (1h antes y durante).
- Cache local agresivo (los partidos terminados no cambian).
- Admin puede **override manual** de cualquier resultado (con audit log).

**Fallback:** si la API falla, admin carga manual.

---

## 6. Modelo de datos (Postgres / Supabase)

```sql
-- ENUMS
create type tournament_stage as enum (
  'group', 'r32', 'r16', 'qf', 'sf', 'third_place', 'final'
);
create type match_status as enum ('scheduled', 'live', 'finished');
create type player_position as enum ('GK', 'DEF', 'MID', 'FWD');

-- USUARIOS (extiende auth.users de Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- CATÁLOGOS
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

-- DEADLINES POR RONDA
create table rounds (
  stage tournament_stage primary key,
  locks_at timestamptz not null
);

-- PARTIDOS
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
create index on matches(scheduled_at);
create index on matches(stage);

-- PREDICCIONES DE PARTIDOS
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
create index on predictions(match_id);

-- PREDICCIONES ESPECIALES (1 por usuario)
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

-- AUDITORÍA
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
```

---

## 7. RLS Policies

```sql
-- PREDICCIONES DE PARTIDO

-- El dueño siempre las ve
create policy "read_own_predictions" on predictions
  for select using (auth.uid() = user_id);

-- Otros usuarios las ven después del kickoff del partido
create policy "read_others_after_kickoff" on predictions
  for select using (
    exists (
      select 1 from matches m
      where m.id = predictions.match_id and m.scheduled_at <= now()
    )
  );

-- Editar: solo el dueño y antes del lock de la ronda del partido
create policy "write_own_predictions_before_lock" on predictions
  for all using (
    auth.uid() = user_id
    and exists (
      select 1 from matches m
      join rounds r on r.stage = m.stage
      where m.id = predictions.match_id and r.locks_at > now()
    )
  );

-- ESPECIALES (Opción A: visibles tras el 1er partido del Mundial)
create policy "read_own_special" on special_predictions
  for select using (auth.uid() = user_id);

create policy "read_others_special_after_wc_starts" on special_predictions
  for select using (
    (select min(scheduled_at) from matches) <= now()
  );

create policy "write_own_special_before_wc_starts" on special_predictions
  for all using (
    auth.uid() = user_id
    and (select min(scheduled_at) from matches) > now()
  );

-- ADMIN: política separada que bypassa todo
create policy "admin_full_access_predictions" on predictions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
-- (Repetir patrón para special_predictions, matches, etc.)
```

---

## 8. Scoring (función + trigger)

```sql
create or replace function calculate_match_points(p predictions, m matches)
returns smallint language plpgsql immutable as $$
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

-- Trigger: cuando un partido pasa a 'finished', recalcula puntos de todas
-- las predicciones de ese partido en bulk.
create or replace function recalc_predictions_for_match()
returns trigger language plpgsql as $$
begin
  if new.status = 'finished' and (old.status is distinct from 'finished'
     or new.home_score is distinct from old.home_score
     or new.away_score is distinct from old.away_score
     or new.pk_winner_team_id is distinct from old.pk_winner_team_id) then
    update predictions p
    set points = calculate_match_points(p, new)
    where p.match_id = new.id;
  end if;
  return new;
end $$;

create trigger trg_recalc_predictions
  after update on matches
  for each row execute function recalc_predictions_for_match();
```

Especiales: función separada `calculate_special_points()` que se invoca al final del torneo (job manual disparado por admin tras la final + publicación oficial de top scorer/MVP).

---

## 9. UX / Vistas

### Participante
- `/predict/groups` — planilla con los 72 partidos de grupos. Inputs de score. Auto-save debounced (~800ms) con indicador "Guardado ✓".
- `/predict/special` — 5 selectores tipo combobox con search (campeón, subcampeón, goleador, mvp, arquero).
- `/predict/[stage]` — vista equivalente para R32, R16, QF, SF, 3rd, Final. Se desbloquea cuando el bracket de esa ronda está completo. Incluye toggle "fue a penales" + selector de ganador de penales.
- `/leaderboard` — tabla global con: posición, nombre, puntos, exactos, ganadores acertados. Click en fila → detalle del prode de esa persona (respetando reveal).
- `/me` — historial personal: % de exactos, racha, mejor/peor jornada.
- `/match/[id]` — pre-kickoff: solo tu predicción. Post-kickoff: tu predicción + de todos los demás + resultado.

### Admin (`/admin/*`)
- Lista de partidos del día con form rápido de carga de resultado (+ toggle penales).
- Botón **"Lock rosters"** (irreversible — pide confirmación).
- Editor de `rounds.locks_at`.
- Estado del sync con api-football (último poll, errores, requests restantes del día).
- Audit log paginado.

---

## 10. Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + RLS + Edge Functions)
- **Auth:** Google OAuth (un admin agrega usuarios a una whitelist o invita por email)
- **Hosting:** Vercel
- **Cron / sync:** Supabase Edge Functions disparadas por pg_cron, o GitHub Actions schedule (alternativa más simple)
- **API resultados:** api-football, plan free

---

## 11. Plan por fases (~10-12 días netos)

### Fase 0 — Setup (1-2 días)
- Repo Next.js + Supabase project + deploy a Vercel
- Migrations: schema completo + RLS + funciones de scoring
- Google OAuth + whitelist de emails
- Seed: 48 teams desde api-football
- Esqueleto de admin panel

### Fase 1 — Predicciones de grupos + especiales (3-4 días)
- Vista de planilla de 72 partidos con auto-save
- Vista de especiales (5 combobox con search)
- Lock automático al kickoff del 1er partido
- Estado read-only post-lock con tu prode siempre visible

### Fase 2 — Admin + ingesta de resultados (2-3 días)
- Edge Function de sync con api-football (poll cada 5 min en ventana de partidos)
- Admin UI de edición de resultados con override + audit log
- Acción "Lock rosters" + seed de jugadores oficiales
- Validar que el trigger de scoring corre y los puntos aparecen

### Fase 3 — Leaderboard + reveal (2 días)
- Tabla global con desempate
- Vista detalle por partido con reveal post-kickoff
- "Mi rendimiento" personal

### Fase 4 — Eliminatorias (1-2 días)
- Vista de carga por ronda (filtrada por `stage`)
- Editor admin de `rounds.locks_at`
- Sync que actualiza `home_team_id`/`away_team_id` cuando se define el bracket

### Fase 5 — Nice-to-haves post-launch
- Notificaciones (push o WhatsApp via Twilio) de "te falta cargar"
- Stats de troleo (mufa, rebelde, espejo del grupo)
- Share cards de tu prode como imagen

---

## 12. Decisiones técnicas pendientes

- [ ] PWA mobile-first vs web normal
- [ ] Canal de notificaciones (push / email / WhatsApp)
- [ ] Single-tournament hardcoded vs schema multi-edición desde el día 1
- [ ] Segundo criterio de desempate (TBD si hay empate al final)
