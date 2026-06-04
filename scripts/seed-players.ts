/**
 * Seed the `players` table from api-football squads.
 *
 * Run when FIFA's pre-tournament 26-man rosters start dropping (~2 weeks
 * pre-kickoff). After running, players exist with is_in_official_roster=false.
 *
 * The admin flips them to true via the "Lock rosters" action in /admin/rosters
 * once the lists are officially final.
 *
 * Burns 48 api-football calls (one per team). Re-runs are safe: upsert on
 * external_id and the latest squad replaces the previous snapshot.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { createApiFootballClient } from "@/lib/api-football/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ApiPlayer = {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
};

const POSITION_MAP: Record<string, "GK" | "DEF" | "MID" | "FWD"> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Attacker: "FWD",
};

type SeedPlayer = {
  external_id: number;
  team_external_id: number;
  team_internal_id: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD" | null;
  jersey_number: number | null;
};

function quoteSql(value: string | null): string {
  if (value === null) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const api = createApiFootballClient();
  const supabase = createSupabaseAdminClient();

  console.log("Loading teams from DB...");
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, external_id, name")
    .order("name");
  if (teamsError) throw teamsError;
  if (!teams || teams.length === 0) {
    throw new Error("No teams in DB. Run `npm run seed:teams` first.");
  }
  console.log(`  -> ${teams.length} teams`);

  const allPlayers: SeedPlayer[] = [];
  let teamsWithSquad = 0;
  let teamsWithoutSquad = 0;

  for (const team of teams) {
    if (team.external_id == null) continue;
    process.stdout.write(`  ${team.name.padEnd(20)} `);
    try {
      const squads = await api.listSquad({ team: team.external_id });
      const players: ApiPlayer[] = squads[0]?.players ?? [];
      if (players.length === 0) {
        process.stdout.write("(no players yet)\n");
        teamsWithoutSquad += 1;
      } else {
        process.stdout.write(`${players.length} players\n`);
        teamsWithSquad += 1;
        for (const p of players) {
          allPlayers.push({
            external_id: p.id,
            team_external_id: team.external_id,
            team_internal_id: team.id,
            name: p.name,
            position: p.position ? (POSITION_MAP[p.position] ?? null) : null,
            jersey_number: p.number,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`ERROR: ${msg}\n`);
    }
    // Gentle rate-limiting; api-football Pro is ~450 req/min, but a small
    // pause makes the script tolerable on lower tiers too.
    await sleep(150);
  }

  console.log(
    `\n  -> ${allPlayers.length} players across ${teamsWithSquad} teams (${teamsWithoutSquad} without squad)`,
  );

  if (allPlayers.length === 0) {
    console.log("Nothing to upsert. Exiting.");
    return;
  }

  console.log("Upserting into Supabase...");
  // Use the resolved internal team_id for the live upsert. Mark every player
  // currently in api-football's squad as is_in_official_roster=true; the
  // post-step below demotes anyone else on the same team. After the FIFA
  // deadline (~7 days pre-kickoff) api-football is the source of truth.
  const rows = allPlayers.map((p) => ({
    external_id: p.external_id,
    team_id: p.team_internal_id,
    name: p.name,
    position: p.position,
    jersey_number: p.jersey_number,
    is_in_official_roster: true,
  }));
  const { error } = await supabase
    .from("players")
    .upsert(rows, { onConflict: "external_id" });
  if (error) throw error;
  console.log(`  -> ok (${rows.length} rows)`);

  // Demote anyone currently flagged official whose external_id isn't in the
  // freshly-pulled batch — including null-external_id rows left behind by
  // the old Wikipedia overlay (`NOT IN (…)` returns NULL on null, so those
  // would silently survive). Done with a single `.or()` filter to cover
  // both cases atomically.
  console.log("Demoting stale players...");
  const currentExternalIds = allPlayers.map((p) => p.external_id);
  const { count: demoted, error: demoteErr } = await supabase
    .from("players")
    .update({ is_in_official_roster: false }, { count: "exact" })
    .eq("is_in_official_roster", true)
    .or(
      `external_id.is.null,external_id.not.in.(${currentExternalIds.join(",")})`,
    );
  if (demoteErr) {
    console.warn(`  demote failed: ${demoteErr.message}`);
  } else {
    console.log(`  -> ${demoted ?? 0} stale players demoted`);
  }

  console.log("Writing supabase/seed-players.sql...");
  const sqlLines = [
    "-- Generated by scripts/seed-players.ts. Re-run `npm run seed:players` to refresh.",
    "-- Idempotent: ON CONFLICT updates the row. Assumes seed.sql (teams) ran first.",
    "-- After the FIFA deadline (~7 days pre-kickoff) api-football is the source of",
    "-- truth so we ship is_in_official_roster=true here. `db reset` followed by",
    "-- this seed gives the same flag state as a live `seed:players` run.",
    "",
    "insert into players (external_id, team_id, name, position, jersey_number, is_in_official_roster)",
    "values",
  ];
  const rowSql = allPlayers.map(
    (p, i) =>
      `  (${p.external_id},` +
      ` (select id from teams where external_id = ${p.team_external_id}),` +
      ` ${quoteSql(p.name)},` +
      ` ${p.position ? `'${p.position}'` : "null"},` +
      ` ${p.jersey_number ?? "null"},` +
      ` true)${i === allPlayers.length - 1 ? "" : ","}`,
  );
  sqlLines.push(...rowSql);
  sqlLines.push("on conflict (external_id) do update set");
  sqlLines.push("  team_id = excluded.team_id,");
  sqlLines.push("  name = excluded.name,");
  sqlLines.push("  position = excluded.position,");
  sqlLines.push("  jersey_number = excluded.jersey_number,");
  sqlLines.push("  is_in_official_roster = excluded.is_in_official_roster;");

  const outPath = path.resolve("supabase/seed-players.sql");
  await writeFile(outPath, `${sqlLines.join("\n")}\n`, "utf8");
  console.log(`  -> wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
