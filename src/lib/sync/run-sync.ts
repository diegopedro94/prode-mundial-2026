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
import { runBracketImport } from "@/lib/sync/import-bracket";

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
      bracketSlotsUpdated: number;
      requestsRemaining: number | null;
    };

// api-football /fixtures?ids= accepts a dash-separated list, capped at 20.
// We won't ever hit that during a single live tournament — the worst case
// would be a knockout day with 4 simultaneous matches.
const MAX_IDS_PER_REQUEST = 20;

async function fetchFixturesByIds(
  externalIds: number[],
): Promise<{
  fixtures: ApiFixture[];
  requestsRemaining: number | null;
}> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");

  const chunks: number[][] = [];
  for (let i = 0; i < externalIds.length; i += MAX_IDS_PER_REQUEST) {
    chunks.push(externalIds.slice(i, i + MAX_IDS_PER_REQUEST));
  }

  const all: ApiFixture[] = [];
  let lastRemaining: number | null = null;
  for (const chunk of chunks) {
    const url = new URL("https://v3.football.api-sports.io/fixtures");
    url.searchParams.set("ids", chunk.join("-"));

    const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    if (!res.ok) {
      throw new Error(
        `api-football /fixtures?ids returned ${res.status}: ${await res.text()}`,
      );
    }
    const remainingHeader = res.headers.get("x-ratelimit-requests-remaining");
    if (remainingHeader) lastRemaining = Number(remainingHeader);
    const body = (await res.json()) as { response: ApiFixture[]; errors?: unknown };
    if (hasApiErrors(body)) {
      throw new Error(
        `api-football /fixtures?ids envelope errors: ${JSON.stringify(body.errors)}`,
      );
    }
    all.push(...(body.response ?? []));
  }
  return { fixtures: all, requestsRemaining: lastRemaining };
}

/**
 * Probe the local DB for matches whose state could change in the next few
 * minutes (already live, or about to kick off), then query api-football for
 * exactly those fixtures and persist the updates.
 *
 * We query by fixture id instead of by date because date-based queries fail
 * across the BA→UTC midnight boundary: a match that kicks off late evening
 * ART and ends past midnight UTC falls into "tomorrow" in api-football's
 * date filter, and the cron silently stops tracking it mid-match.
 *
 * Returns kind=skipped when there's no live or imminent match — caller
 * should treat that as a successful no-op, not an error.
 */
export async function runSync(
  supabase: SupabaseClient<Database>,
): Promise<RunSyncResult> {
  const now = new Date();
  const imminentCutoff = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const { data: relevant, error: probeError } = await supabase
    .from("matches")
    .select("id, external_id, status, scheduled_at")
    .or(`status.eq.live,and(status.eq.scheduled,scheduled_at.lte.${imminentCutoff})`)
    .not("external_id", "is", null);
  if (probeError) {
    throw new Error(`DB probe failed: ${probeError.message}`);
  }

  const hasLiveOrImminent = (relevant?.length ?? 0) > 0;

  // Even without a live/imminent match, we still want to run the bracket
  // import when there are TBD slots ahead — that's how the next round
  // populates dynamically as api-football publishes new fixtures. The
  // bracket importer has its own DB probe and short-circuits when nothing
  // is missing, so calling it always is cheap.
  let bracketSlotsUpdated = 0;
  let bracketResult: Awaited<ReturnType<typeof runBracketImport>>;
  try {
    bracketResult = await runBracketImport(supabase);
    if (bracketResult.kind === "success") {
      bracketSlotsUpdated = bracketResult.updated;
    }
  } catch (err) {
    // Log via caller (sync_log); don't fail the whole sync over a bracket
    // hiccup — the live-match path is more important.
    console.warn(
      "bracket import failed:",
      err instanceof Error ? err.message : err,
    );
    bracketResult = { kind: "skipped", reason: "bracket import errored" };
  }

  if (!hasLiveOrImminent) {
    return {
      kind: "success",
      fixturesProcessed: 0,
      fixturesUpdated: 0,
      goalsUpserted: 0,
      bracketSlotsUpdated,
      requestsRemaining: null,
    };
  }

  const externalIds = relevant!
    .map((r) => r.external_id)
    .filter((x): x is number => typeof x === "number");

  const { fixtures, requestsRemaining } = await fetchFixturesByIds(externalIds);
  if (fixtures.length === 0) {
    return {
      kind: "success",
      fixturesProcessed: 0,
      fixturesUpdated: 0,
      goalsUpserted: 0,
      bracketSlotsUpdated,
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
    bracketSlotsUpdated,
    requestsRemaining,
  };
}
