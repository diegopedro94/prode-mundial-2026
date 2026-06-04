import type { Database, TablesInsert } from "@/lib/database.types";
import { hasApiErrors } from "@/lib/sync/parse-fixture";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiEvent = {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  type: string;
  detail: string;
};

export async function fetchFixtureEvents(fixtureId: number): Promise<ApiEvent[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");
  const url = new URL("https://v3.football.api-sports.io/fixtures/events");
  url.searchParams.set("fixture", String(fixtureId));
  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (!res.ok) {
    throw new Error(
      `api-football /fixtures/events returned ${res.status}: ${await res.text()}`,
    );
  }
  const body = (await res.json()) as { response: ApiEvent[]; errors?: unknown };
  if (hasApiErrors(body)) {
    throw new Error(
      `api-football /fixtures/events envelope errors: ${JSON.stringify(body.errors)}`,
    );
  }
  return body.response ?? [];
}

export type SyncGoalsResult = {
  inserted: number;
  skippedNoTeam: number;
  skippedNoPlayer: number;
  fetched: number;
};

export type SyncGoalsOptions = {
  /** Re-fetch even if the match already has goals on file (used by the
   *  admin "refresh goals" button when api-football publishes corrections). */
  force?: boolean;
};

/**
 * Pull /fixtures/events for a fixture, filter Goal-type entries, ensure each
 * scorer exists in `players`, then DELETE+INSERT goals atomically so the call
 * is idempotent (re-polling a finished match doesn't double the count).
 */
export async function syncGoalsForFixture(
  supabase: SupabaseClient<Database>,
  fixtureExternalId: number,
  teamExternalToInternal: Map<number, number>,
  options: SyncGoalsOptions = {},
): Promise<SyncGoalsResult> {
  const result: SyncGoalsResult = {
    inserted: 0,
    skippedNoTeam: 0,
    skippedNoPlayer: 0,
    fetched: 0,
  };

  const { data: matchRow } = await supabase
    .from("matches")
    .select("id")
    .eq("external_id", fixtureExternalId)
    .maybeSingle();
  if (!matchRow) return result;
  const internalMatchId = matchRow.id;

  if (!options.force) {
    const { count: existingGoals } = await supabase
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("match_id", internalMatchId);
    if ((existingGoals ?? 0) > 0) return result;
  }

  const events = await fetchFixtureEvents(fixtureExternalId);
  result.fetched = events.length;

  const goalRows: TablesInsert<"goals">[] = [];
  for (const ev of events) {
    if (ev.type !== "Goal" || ev.detail === "Missed Penalty") continue;
    if (ev.player.id == null) {
      result.skippedNoPlayer += 1;
      continue;
    }
    const teamInternalId = teamExternalToInternal.get(ev.team.id);
    if (!teamInternalId) {
      result.skippedNoTeam += 1;
      continue;
    }

    let { data: playerRow } = await supabase
      .from("players")
      .select("id")
      .eq("external_id", ev.player.id)
      .maybeSingle();
    if (!playerRow) {
      const { data: inserted, error: insertErr } = await supabase
        .from("players")
        .insert({
          external_id: ev.player.id,
          team_id: teamInternalId,
          name: ev.player.name ?? `Player ${ev.player.id}`,
          is_in_official_roster: false,
        })
        .select("id")
        .single();
      if (insertErr) {
        result.skippedNoPlayer += 1;
        continue;
      }
      playerRow = inserted!;
    }

    const minute =
      ev.time.elapsed != null
        ? ev.time.elapsed + (ev.time.extra ?? 0)
        : null;
    goalRows.push({
      match_id: internalMatchId,
      player_id: playerRow.id,
      team_id: teamInternalId,
      minute,
      is_penalty: ev.detail === "Penalty",
      is_own_goal: ev.detail === "Own Goal",
    });
  }

  // DELETE+INSERT for idempotency. If force=true, this lets corrections from
  // api-football reach the leaderboard.
  await supabase.from("goals").delete().eq("match_id", internalMatchId);
  if (goalRows.length > 0) {
    const { error } = await supabase.from("goals").insert(goalRows);
    if (error) throw error;
    result.inserted = goalRows.length;
  }
  return result;
}

export async function loadTeamExternalIndex(
  supabase: SupabaseClient<Database>,
): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, external_id");
  if (error) throw error;
  const map = new Map<number, number>();
  for (const t of data ?? []) {
    if (t.external_id != null) map.set(t.external_id, t.id);
  }
  return map;
}
