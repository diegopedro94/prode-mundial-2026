/**
 * One-shot importer: pull knockout fixtures from api-football and bind them
 * to our pre-seeded `matches` rows by scheduled_at proximity.
 *
 * For each api-football fixture in a knockout round we already know about,
 * we update the matching DB row with:
 *   - external_id     (so the live sync can pick it up)
 *   - home_team_id    (mapped via teams.external_id)
 *   - away_team_id    (same)
 *   - scheduled_at    (in case FIFA bumped the kickoff slot)
 *
 * Idempotent: re-running won't double-write or shuffle teams that are already
 * in place.
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { loadTeamExternalIndex } from "@/lib/sync/goals";

type ApiFixture = {
  fixture: { id: number; date: string };
  league: { round: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
};

const KNOCKOUT_ROUND_TO_STAGE: Record<string, "r32" | "r16" | "qf" | "sf" | "third_place" | "final"> = {
  "Round of 32": "r32",
  "Round of 16": "r16",
  "Quarter-finals": "qf",
  "Semi-finals": "sf",
  "3rd Place Final": "third_place",
  Final: "final",
};

// How far away (in hours) a DB slot can be from an api-football kickoff and
// still be considered "the same" match. FIFA sometimes shifts a slot by a few
// hours; we want to absorb that without manual intervention.
const MAX_MATCH_HOURS = 6;

async function fetchAllWcFixtures(): Promise<ApiFixture[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");
  const res = await fetch(
    "https://v3.football.api-sports.io/fixtures?league=1&season=2026",
    { headers: { "x-apisports-key": apiKey } },
  );
  if (!res.ok) {
    throw new Error(`api-football /fixtures returned ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { response: ApiFixture[] };
  return body.response ?? [];
}

async function main() {
  const url = process.env.SUPABASE_URL_CLOUD ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY_CLOUD ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL_CLOUD/SUPABASE_SERVICE_ROLE_KEY_CLOUD");

  const admin = createClient<Database>(url, key, { auth: { persistSession: false } });
  const externalToInternalTeam = await loadTeamExternalIndex(admin);

  const allFixtures = await fetchAllWcFixtures();
  const knockoutFixtures = allFixtures.filter(
    (f) => KNOCKOUT_ROUND_TO_STAGE[f.league.round] != null,
  );
  console.log(`api-football has ${knockoutFixtures.length} knockout fixtures published.`);

  // Pull our DB knockout slots, grouped by stage.
  const { data: slotsData, error: slotsErr } = await admin
    .from("matches")
    .select("id, stage, scheduled_at, external_id, home_team_id, away_team_id")
    .neq("stage", "group");
  if (slotsErr) throw new Error(slotsErr.message);
  const slotsByStage = new Map<string, typeof slotsData>();
  for (const s of slotsData ?? []) {
    const arr = slotsByStage.get(s.stage) ?? [];
    arr.push(s);
    slotsByStage.set(s.stage, arr);
  }

  let updated = 0;
  let skippedNoTeam = 0;
  let skippedNoSlot = 0;
  let alreadyOk = 0;

  for (const fx of knockoutFixtures) {
    const stage = KNOCKOUT_ROUND_TO_STAGE[fx.league.round]!;
    const homeInternal = externalToInternalTeam.get(fx.teams.home.id);
    const awayInternal = externalToInternalTeam.get(fx.teams.away.id);
    if (!homeInternal || !awayInternal) {
      console.warn(
        `  skip fx=${fx.fixture.id} (${fx.teams.home.name} vs ${fx.teams.away.name}): team(s) not in our DB`,
      );
      skippedNoTeam += 1;
      continue;
    }

    const slots = slotsByStage.get(stage) ?? [];
    if (slots.length === 0) {
      console.warn(`  skip fx=${fx.fixture.id}: no slots for stage=${stage}`);
      skippedNoSlot += 1;
      continue;
    }

    // Prefer the slot already pinned to this external_id; otherwise pick the
    // closest scheduled_at within the tolerance, restricted to slots that
    // haven't been claimed by another fixture yet.
    const pinned = slots.find((s) => s.external_id === fx.fixture.id);
    const candidate =
      pinned ??
      slots
        .filter((s) => s.external_id == null)
        .map((s) => ({
          slot: s,
          hours: Math.abs(
            new Date(s.scheduled_at).getTime() - new Date(fx.fixture.date).getTime(),
          ) / (60 * 60 * 1000),
        }))
        .filter((c) => c.hours <= MAX_MATCH_HOURS)
        .sort((a, b) => a.hours - b.hours)[0]?.slot;

    if (!candidate) {
      console.warn(
        `  skip fx=${fx.fixture.id} ${fx.teams.home.name} vs ${fx.teams.away.name} at ${fx.fixture.date}: no slot within ${MAX_MATCH_HOURS}h tolerance`,
      );
      skippedNoSlot += 1;
      continue;
    }

    const alreadyMatches =
      candidate.external_id === fx.fixture.id &&
      candidate.home_team_id === homeInternal &&
      candidate.away_team_id === awayInternal &&
      new Date(candidate.scheduled_at).toISOString() ===
        new Date(fx.fixture.date).toISOString();
    if (alreadyMatches) {
      alreadyOk += 1;
      continue;
    }

    const { error } = await admin
      .from("matches")
      .update({
        external_id: fx.fixture.id,
        home_team_id: homeInternal,
        away_team_id: awayInternal,
        scheduled_at: fx.fixture.date,
      })
      .eq("id", candidate.id);
    if (error) {
      console.warn(`  fx=${fx.fixture.id} update failed:`, error.message);
      continue;
    }
    console.log(
      `  ok: ${stage} slot id=${candidate.id} -> ${fx.teams.home.name} vs ${fx.teams.away.name} @ ${fx.fixture.date} (ext=${fx.fixture.id})`,
    );
    // Mark the slot as claimed so the next fixture doesn't pick it.
    candidate.external_id = fx.fixture.id;
    updated += 1;
  }

  console.log(
    `\nDone. updated=${updated} alreadyOk=${alreadyOk} skippedNoTeam=${skippedNoTeam} skippedNoSlot=${skippedNoSlot}`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
