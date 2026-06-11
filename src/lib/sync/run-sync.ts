import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
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

export type RunSyncResult =
  | {
      kind: "skipped";
      reason: string;
    }
  | {
      kind: "success";
      fixturesProcessed: number;
      fixturesUpdated: number;
      goalsUpserted: number;
      requestsRemaining: number | null;
    };

function todayInTz(date?: Date): string {
  return (date ?? new Date()).toLocaleDateString("en-CA", { timeZone: TIMEZONE });
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
  if (hasApiErrors(body)) {
    throw new Error(`api-football /fixtures envelope errors: ${JSON.stringify(body.errors)}`);
  }
  return { fixtures: body.response ?? [], requestsRemaining };
}

/**
 * Probe + sync today's fixtures. Designed to be called from both the GHA
 * cron (scripts/sync-results.ts) and the in-app server action triggered by
 * /live.
 *
 * Returns kind=skipped when there's no live or imminent match — caller
 * should treat that as a successful no-op, not an error.
 */
export async function runSync(
  supabase: SupabaseClient<Database>,
  options: { overrideDate?: string } = {},
): Promise<RunSyncResult> {
  const date = options.overrideDate ?? todayInTz();

  const now = new Date();
  const imminentCutoff = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const { data: relevant, error: probeError } = await supabase
    .from("matches")
    .select("id, status, scheduled_at")
    .or(`status.eq.live,and(status.eq.scheduled,scheduled_at.lte.${imminentCutoff})`)
    .limit(1);
  if (probeError) {
    throw new Error(`DB probe failed: ${probeError.message}`);
  }
  if (!relevant || relevant.length === 0) {
    return { kind: "skipped", reason: "no live or imminent matches" };
  }

  const { fixtures, requestsRemaining } = await fetchFixtures(date);
  if (fixtures.length === 0) {
    return {
      kind: "success",
      fixturesProcessed: 0,
      fixturesUpdated: 0,
      goalsUpserted: 0,
      requestsRemaining,
    };
  }

  const externalToInternal = await loadTeamExternalIndex(supabase);

  let updated = 0;
  let goalsUpserted = 0;
  for (const fixture of fixtures) {
    const home = externalToInternal.get(fixture.teams.home.id);
    const away = externalToInternal.get(fixture.teams.away.id);
    if (!home || !away) continue;

    const parsed = parseApiFixture(fixture, home, away);
    if (parsed.kind === "skip") continue;

    const { error } = await supabase
      .from("matches")
      .update(parsed.update)
      .eq("external_id", fixture.fixture.id);
    if (error) continue;
    updated += 1;

    if (parsed.update.status === "finished") {
      try {
        const r = await syncGoalsForFixture(
          supabase,
          fixture.fixture.id,
          externalToInternal,
        );
        goalsUpserted += r.inserted;
      } catch {
        // Captured upstream via sync_log if caller chooses to log; we keep
        // moving so a single goal-fetch failure doesn't block other matches.
      }
    }
  }

  return {
    kind: "success",
    fixturesProcessed: fixtures.length,
    fixturesUpdated: updated,
    goalsUpserted,
    requestsRemaining,
  };
}
