/**
 * Poll api-football for today's fixtures and upsert into `matches`.
 *
 * Designed to run from a GitHub Actions cron during the tournament window.
 * Idempotent: only writes rows whose state actually changed.
 *
 * Logs every run to `sync_log` so /admin/sync can show status.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  hasApiErrors,
  parseApiFixture,
  type ApiFixturePayload,
} from "@/lib/sync/parse-fixture";
import {
  loadTeamExternalIndex,
  syncGoalsForFixture,
} from "@/lib/sync/goals";

const LEAGUE_WORLD_CUP = 1;
const SEASON = 2026;
const TIMEZONE = "America/Argentina/Buenos_Aires";

type ApiFixture = ApiFixturePayload & {
  fixture: ApiFixturePayload["fixture"] & { date: string };
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
  const body = (await res.json()) as { response: ApiFixture[]; errors?: unknown };
  // api-football returns 200 + empty response when plan/token rejections hit.
  // Treat the envelope errors as hard failure so sync_log captures it.
  if (hasApiErrors(body)) {
    throw new Error(`api-football /fixtures envelope errors: ${JSON.stringify(body.errors)}`);
  }
  return { fixtures: body.response ?? [], requestsRemaining };
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
    const externalToInternal = await loadTeamExternalIndex(supabase);

    let updated = 0;
    let skipped = 0;
    let goalsUpserted = 0;
    for (const fixture of fixtures) {
      const home = externalToInternal.get(fixture.teams.home.id);
      const away = externalToInternal.get(fixture.teams.away.id);
      if (!home || !away) {
        console.warn(
          `  skip fixture ${fixture.fixture.id}: home/away team not in DB`,
        );
        skipped += 1;
        continue;
      }
      const parsed = parseApiFixture(fixture, home, away);
      if (parsed.kind === "skip") {
        console.warn(`  skip fixture ${fixture.fixture.id}: ${parsed.reason}`);
        skipped += 1;
        continue;
      }
      const update = parsed.update;

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

      // Capture goleadores for finished matches that don't have any goals in
      // our DB yet. Corrections after the fact get a manual "refresh goals"
      // path from /admin/matches/[id].
      if (update.status === "finished") {
        try {
          const r = await syncGoalsForFixture(
            supabase,
            fixture.fixture.id,
            externalToInternal,
          );
          goalsUpserted += r.inserted;
        } catch (err) {
          console.warn(
            `  fixture ${fixture.fixture.id} goals fetch failed:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
    if (goalsUpserted > 0) {
      console.log(`  -> ${goalsUpserted} goals inserted across finished matches`);
    }
    if (skipped > 0) {
      console.log(`  -> ${skipped} fixtures skipped (see warnings above)`);
    }

    const errorMessage =
      skipped > 0 ? `${skipped} fixture(s) skipped — see logs` : null;

    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        fixtures_processed: fixtures.length,
        fixtures_updated: updated,
        requests_remaining: requestsRemaining,
        error_message: errorMessage,
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
