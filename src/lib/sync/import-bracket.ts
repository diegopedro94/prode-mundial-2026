/**
 * Idempotent knockout-bracket importer.
 *
 * Every time a match transitions to finished, api-football publishes a fresh
 * fixture for the next-round match with the qualifying team wired in. We
 * mirror that: probe our knockout rows for any slot that's still missing
 * teams or an external_id, and if any exist, pull the WC fixtures once and
 * bind matches to slots by (stage + scheduled_at proximity).
 *
 * Cheap fast-path: if every knockout slot with a kickoff within the next 30
 * days already has both teams AND an external_id, we skip the API call.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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

const KNOCKOUT_ROUND_TO_STAGE: Record<
  string,
  "r32" | "r16" | "qf" | "sf" | "third_place" | "final"
> = {
  "Round of 32": "r32",
  "Round of 16": "r16",
  "Quarter-finals": "qf",
  "Semi-finals": "sf",
  "3rd Place Final": "third_place",
  Final: "final",
};

const MAX_MATCH_HOURS = 6;

export type BracketImportResult =
  | { kind: "skipped"; reason: string }
  | {
      kind: "success";
      updated: number;
      apiFixturesSeen: number;
    };

async function fetchAllWcFixtures(): Promise<ApiFixture[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");
  const res = await fetch(
    "https://v3.football.api-sports.io/fixtures?league=1&season=2026",
    { headers: { "x-apisports-key": apiKey } },
  );
  if (!res.ok) {
    throw new Error(
      `api-football /fixtures returned ${res.status}: ${await res.text()}`,
    );
  }
  const body = (await res.json()) as { response: ApiFixture[] };
  return body.response ?? [];
}

export async function runBracketImport(
  admin: SupabaseClient<Database>,
): Promise<BracketImportResult> {
  // Fast-path probe: are there knockout rows that could still be updated?
  // A row "needs work" if (a) it has no external_id yet, OR (b) either team
  // is null. Skip if none within the next month — most likely mid-tournament
  // idle time between rounds.
  const monthAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: needsWork, error: probeErr } = await admin
    .from("matches")
    .select("id")
    .neq("stage", "group")
    .lt("scheduled_at", monthAhead)
    .or("external_id.is.null,home_team_id.is.null,away_team_id.is.null")
    .limit(1);
  if (probeErr) {
    throw new Error(`bracket probe failed: ${probeErr.message}`);
  }
  if (!needsWork || needsWork.length === 0) {
    return { kind: "skipped", reason: "all knockout slots already filled" };
  }

  // Pull the state we need to bind: existing slots + team external index.
  const [{ data: slotsData, error: slotsErr }, externalToInternalTeam] =
    await Promise.all([
      admin
        .from("matches")
        .select("id, stage, scheduled_at, external_id, home_team_id, away_team_id")
        .neq("stage", "group"),
      loadTeamExternalIndex(admin),
    ]);
  if (slotsErr) throw new Error(`bracket slots read failed: ${slotsErr.message}`);

  const allFixtures = await fetchAllWcFixtures();
  const knockoutFixtures = allFixtures.filter(
    (f) => KNOCKOUT_ROUND_TO_STAGE[f.league.round] != null,
  );

  const slotsByStage = new Map<string, typeof slotsData>();
  for (const s of slotsData ?? []) {
    const arr = slotsByStage.get(s.stage) ?? [];
    arr.push(s);
    slotsByStage.set(s.stage, arr);
  }

  let updated = 0;
  for (const fx of knockoutFixtures) {
    const stage = KNOCKOUT_ROUND_TO_STAGE[fx.league.round]!;
    const homeInternal = externalToInternalTeam.get(fx.teams.home.id);
    const awayInternal = externalToInternalTeam.get(fx.teams.away.id);
    if (!homeInternal || !awayInternal) continue; // teams not in our DB yet

    const slots = slotsByStage.get(stage) ?? [];
    if (slots.length === 0) continue;

    const pinned = slots.find((s) => s.external_id === fx.fixture.id);
    const candidate =
      pinned ??
      slots
        .filter((s) => s.external_id == null)
        .map((s) => ({
          slot: s,
          hours:
            Math.abs(
              new Date(s.scheduled_at).getTime() - new Date(fx.fixture.date).getTime(),
            ) / (60 * 60 * 1000),
        }))
        .filter((c) => c.hours <= MAX_MATCH_HOURS)
        .sort((a, b) => a.hours - b.hours)[0]?.slot;
    if (!candidate) continue;

    const alreadyOk =
      candidate.external_id === fx.fixture.id &&
      candidate.home_team_id === homeInternal &&
      candidate.away_team_id === awayInternal &&
      new Date(candidate.scheduled_at).toISOString() ===
        new Date(fx.fixture.date).toISOString();
    if (alreadyOk) continue;

    const { error } = await admin
      .from("matches")
      .update({
        external_id: fx.fixture.id,
        home_team_id: homeInternal,
        away_team_id: awayInternal,
        scheduled_at: fx.fixture.date,
      })
      .eq("id", candidate.id);
    if (error) continue;
    candidate.external_id = fx.fixture.id;
    updated += 1;
  }

  return { kind: "success", updated, apiFixturesSeen: knockoutFixtures.length };
}
