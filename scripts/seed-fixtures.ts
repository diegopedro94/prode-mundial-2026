/**
 * Seed the `matches` table from api-football fixtures.
 *
 * Prerequisites:
 *   - teams already seeded (`npm run seed:teams`)
 *   - API_FOOTBALL_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Idempotent (upsert on external_id). Writes `supabase/seed-fixtures.sql`
 * so future `db:reset` runs replay the data without hitting the API.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { createApiFootballClient } from "@/lib/api-football/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LEAGUE_WORLD_CUP = 1;
const SEASON = 2026;

type Fixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { round: string };
  teams: {
    home: { id: number };
    away: { id: number };
  };
};

type SeedMatch = {
  external_id: number;
  stage: "group";
  group_letter: string;
  home_team_id: number;
  away_team_id: number;
  home_external_id: number;
  away_external_id: number;
  scheduled_at: string;
};

function isGroupStageRound(round: string): boolean {
  // api-football labels them "Group Stage - 1/2/3" (no letter — derive from teams).
  return /^Group\s+Stage\b/i.test(round);
}

function quoteSql(value: string | null) {
  if (value === null) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

async function fetchFixtures(apiKey: string): Promise<Fixture[]> {
  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("league", String(LEAGUE_WORLD_CUP));
  url.searchParams.set("season", String(SEASON));
  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (!res.ok) {
    throw new Error(`api-football /fixtures returned ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { response: Fixture[] };
  return body.response;
}

async function main() {
  // We need the api key for fixtures even if our typed client doesn't expose
  // /fixtures yet (kept lightweight to avoid adding seldom-used surface area).
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");
  // Sanity-check the typed client too so misconfig surfaces early.
  createApiFootballClient({ apiKey });

  const supabase = createSupabaseAdminClient();

  console.log("Loading teams from DB...");
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, external_id, name, group_letter");
  if (teamsError) throw teamsError;
  if (!teams || teams.length === 0) {
    throw new Error("No teams in DB. Run `npm run seed:teams` first.");
  }
  // We track both the local internal id (for the live upsert) and the
  // external_id (for the portable SQL dump — internal serials differ between
  // local and cloud, so the SQL resolves teams via subquery on external_id).
  const externalIndex = new Map<
    number,
    { id: number; externalId: number; group: string | null }
  >();
  for (const t of teams) {
    if (t.external_id != null) {
      externalIndex.set(t.external_id, {
        id: t.id,
        externalId: t.external_id,
        group: t.group_letter,
      });
    }
  }
  console.log(`  -> ${externalIndex.size} teams indexed`);

  console.log(`Fetching fixtures for league=${LEAGUE_WORLD_CUP} season=${SEASON}...`);
  const fixtures = await fetchFixtures(apiKey);
  console.log(`  -> ${fixtures.length} fixtures total`);

  const groupFixtures = fixtures.filter((f) => isGroupStageRound(f.league.round));
  console.log(`  -> ${groupFixtures.length} group-stage fixtures`);

  const seeds: SeedMatch[] = [];
  const skipped: Array<{ id: number; reason: string }> = [];
  for (const f of groupFixtures) {
    const home = externalIndex.get(f.teams.home.id);
    const away = externalIndex.get(f.teams.away.id);
    if (!home || !away) {
      skipped.push({ id: f.fixture.id, reason: "team missing" });
      continue;
    }
    const group = home.group ?? away.group;
    if (!group) {
      skipped.push({ id: f.fixture.id, reason: "no group on either team" });
      continue;
    }
    seeds.push({
      external_id: f.fixture.id,
      stage: "group",
      group_letter: group,
      home_team_id: home.id,
      away_team_id: away.id,
      home_external_id: home.externalId,
      away_external_id: away.externalId,
      scheduled_at: f.fixture.date,
    });
  }
  if (skipped.length > 0) {
    console.warn(`  -> skipped ${skipped.length}:`, skipped.slice(0, 5));
  }

  // Strip the helper external_ids before sending to supabase (they're only for the SQL dump).
  const upsertRows = seeds.map(
    ({ home_external_id: _h, away_external_id: _a, ...row }) => row,
  );
  console.log("Upserting into Supabase...");
  const { error } = await supabase
    .from("matches")
    .upsert(upsertRows, { onConflict: "external_id" });
  if (error) throw error;
  console.log(`  -> ok (${upsertRows.length} rows)`);

  console.log("Writing supabase/seed-fixtures.sql...");
  // Resolve team_ids via subquery on external_id so this SQL is portable
  // across DBs where the teams serial generated different ids.
  const sqlLines = [
    "-- Generated by scripts/seed-fixtures.ts. Re-run `npm run seed:fixtures` to refresh.",
    "-- Idempotent: ON CONFLICT updates the row. Assumes seed.sql (teams) ran first.",
    "",
    "insert into matches (external_id, stage, group_letter, home_team_id, away_team_id, scheduled_at)",
    "values",
  ];
  const rows = seeds.map(
    (s, i) =>
      `  (${s.external_id}, 'group', ${quoteSql(s.group_letter)},` +
      ` (select id from teams where external_id = ${s.home_external_id}),` +
      ` (select id from teams where external_id = ${s.away_external_id}),` +
      ` ${quoteSql(s.scheduled_at)})${i === seeds.length - 1 ? "" : ","}`,
  );
  sqlLines.push(...rows);
  sqlLines.push("on conflict (external_id) do update set");
  sqlLines.push("  stage = excluded.stage,");
  sqlLines.push("  group_letter = excluded.group_letter,");
  sqlLines.push("  home_team_id = excluded.home_team_id,");
  sqlLines.push("  away_team_id = excluded.away_team_id,");
  sqlLines.push("  scheduled_at = excluded.scheduled_at;");

  const outPath = path.resolve("supabase/seed-fixtures.sql");
  await writeFile(outPath, `${sqlLines.join("\n")}\n`, "utf8");
  console.log(`  -> wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
