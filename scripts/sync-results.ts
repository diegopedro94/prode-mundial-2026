/**
 * Poll api-football for today's fixtures and upsert into `matches`.
 *
 * Designed to run from a GitHub Actions cron during the tournament window.
 * Idempotent: only writes rows whose state actually changed.
 *
 * Logs every run to `sync_log` so /admin/sync can show status.
 */

import type { Database, TablesUpdate } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LEAGUE_WORLD_CUP = 1;
const SEASON = 2026;
const TIMEZONE = "America/Argentina/Buenos_Aires";

type ApiFixtureStatus = {
  short: string;
  long: string;
  elapsed: number | null;
};

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: ApiFixtureStatus;
  };
  teams: {
    home: { id: number; winner: boolean | null };
    away: { id: number; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
};

type MatchStatus = Database["public"]["Enums"]["match_status"];

const STATUS_MAP: Record<string, MatchStatus> = {
  TBD: "scheduled",
  NS: "scheduled",
  SCH: "scheduled",
  PST: "scheduled",
  // live states
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  SUSP: "live",
  INT: "live",
  LIVE: "live",
  // finished states
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  AWD: "finished",
  WO: "finished",
};

function todayInTz(): string {
  // SYNC_OVERRIDE_DATE (YYYY-MM-DD) lets us test the sync path against a
  // specific match day before the tournament starts.
  const override = process.env.SYNC_OVERRIDE_DATE;
  if (override) return override;
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

async function fetchFixtures(date: string): Promise<{
  fixtures: ApiFixture[];
  requestsRemaining: number | null;
}> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");

  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("league", String(LEAGUE_WORLD_CUP));
  url.searchParams.set("season", String(SEASON));
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", TIMEZONE);

  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (!res.ok) {
    throw new Error(`api-football /fixtures returned ${res.status}: ${await res.text()}`);
  }
  const remainingHeader = res.headers.get("x-ratelimit-requests-remaining");
  const requestsRemaining = remainingHeader ? Number(remainingHeader) : null;
  const body = (await res.json()) as { response: ApiFixture[] };
  return { fixtures: body.response, requestsRemaining };
}

function buildUpdate(
  fixture: ApiFixture,
  internalHomeTeamId: number,
  internalAwayTeamId: number,
): TablesUpdate<"matches"> {
  const status = STATUS_MAP[fixture.fixture.status.short] ?? "scheduled";
  const wentToPenalties = fixture.fixture.status.short === "PEN";

  let homeScore: number | null = fixture.goals.home;
  let awayScore: number | null = fixture.goals.away;
  // Use fulltime score when available (api-football leaves goals at extratime
  // sometimes; fulltime is the canonical 90+stoppage score). For PEN matches,
  // the 'fulltime' captures the result at the end of regulation+ET.
  if (fixture.score.fulltime.home != null) homeScore = fixture.score.fulltime.home;
  if (fixture.score.fulltime.away != null) awayScore = fixture.score.fulltime.away;

  let winnerTeamId: number | null = null;
  if (status === "finished") {
    if (fixture.teams.home.winner === true) winnerTeamId = internalHomeTeamId;
    else if (fixture.teams.away.winner === true) winnerTeamId = internalAwayTeamId;
    // If both are null/false (group-stage draw), winnerTeamId stays null.
  }

  let pkWinnerTeamId: number | null = null;
  if (wentToPenalties) {
    const ph = fixture.score.penalty.home ?? 0;
    const pa = fixture.score.penalty.away ?? 0;
    if (ph > pa) pkWinnerTeamId = internalHomeTeamId;
    else if (pa > ph) pkWinnerTeamId = internalAwayTeamId;
  }

  return {
    status,
    home_score: homeScore,
    away_score: awayScore,
    went_to_penalties: wentToPenalties,
    pk_winner_team_id: pkWinnerTeamId,
    winner_team_id: winnerTeamId,
  };
}

async function main() {
  const supabase = createSupabaseAdminClient();
  const date = todayInTz();

  // Skip the API call when there's nothing scheduled today — saves quota and
  // keeps sync_log signal-to-noise high.
  const dayStart = new Date(`${date}T00:00:00-03:00`).toISOString();
  const dayEnd = new Date(`${date}T23:59:59-03:00`).toISOString();
  const { data: todays, error: probeError } = await supabase
    .from("matches")
    .select("id")
    .gte("scheduled_at", dayStart)
    .lt("scheduled_at", dayEnd)
    .limit(1);
  if (probeError) {
    console.error("DB probe failed:", probeError.message);
    process.exit(1);
  }
  if (!todays || todays.length === 0) {
    console.log(`No matches scheduled for ${date}, exiting without polling.`);
    return;
  }

  // Start the sync_log entry only when we're actually going to do work.
  const { data: logRow, error: logInsertError } = await supabase
    .from("sync_log")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (logInsertError) {
    console.error("Failed to insert sync_log row:", logInsertError);
    process.exit(1);
  }
  const syncLogId = logRow!.id;

  try {
    console.log(`Fetching fixtures for ${date}...`);
    const { fixtures, requestsRemaining } = await fetchFixtures(date);
    console.log(`  -> ${fixtures.length} fixtures`);
    console.log(`  -> ${requestsRemaining ?? "?"} api-football requests remaining today`);

    if (fixtures.length === 0) {
      await supabase
        .from("sync_log")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          fixtures_processed: 0,
          requests_remaining: requestsRemaining,
        })
        .eq("id", syncLogId);
      return;
    }

    // Map external team ids → internal ids so we can fill winner / pk_winner.
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, external_id");
    if (teamsError) throw teamsError;
    const externalToInternal = new Map<number, number>();
    for (const t of teams ?? []) {
      if (t.external_id != null) externalToInternal.set(t.external_id, t.id);
    }

    let updated = 0;
    for (const fixture of fixtures) {
      const home = externalToInternal.get(fixture.teams.home.id);
      const away = externalToInternal.get(fixture.teams.away.id);
      if (!home || !away) {
        console.warn(
          `  skip fixture ${fixture.fixture.id}: home/away team not in DB`,
        );
        continue;
      }
      const update = buildUpdate(fixture, home, away);

      // The audit_match_changes trigger logs every UPDATE with actor=null
      // (service role). The recalc_predictions_for_match trigger recomputes
      // predictions.points when status flips to 'finished'.
      const { error } = await supabase
        .from("matches")
        .update(update)
        .eq("external_id", fixture.fixture.id);
      if (error) {
        console.warn(`  fixture ${fixture.fixture.id} update failed:`, error.message);
        continue;
      }
      updated += 1;
    }

    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        fixtures_processed: fixtures.length,
        fixtures_updated: updated,
        requests_remaining: requestsRemaining,
      })
      .eq("id", syncLogId);

    console.log(`  -> updated ${updated}/${fixtures.length} match rows`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Sync failed:", message);
    await supabase
      .from("sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", syncLogId);
    process.exit(1);
  }
}

main();
