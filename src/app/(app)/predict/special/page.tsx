import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SpecialForm } from "./special-form";

type TeamRow = {
  id: number;
  name: string;
  fifa_code: string;
  flag_url: string | null;
};

type PlayerRow = {
  id: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD" | null;
  jersey_number: number | null;
  team: { fifa_code: string; flag_url: string | null } | null;
};

type SpecialRow = {
  champion_team_id: number | null;
  runner_up_team_id: number | null;
  top_scorer_player_id: number | null;
  mvp_player_id: number | null;
  best_gk_player_id: number | null;
};

type RoundRow = { locks_at: string };

export default async function PredictSpecialPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const [teamsRes, players, specialRes, roundRes] = await Promise.all([
    supabase.from("teams").select("id, name, fifa_code, flag_url").order("name"),
    // Supabase REST caps at 1000 rows per request; the 48 × 26 = 1248 official
    // players are over that. Paginate so the players from late letters of the
    // alphabet aren't silently dropped (which was hiding e.g. Courtois).
    fetchAllPlayers(supabase),
    supabase
      .from("special_predictions")
      .select(
        "champion_team_id, runner_up_team_id, top_scorer_player_id, mvp_player_id, best_gk_player_id",
      )
      .eq("user_id", userId)
      .maybeSingle<SpecialRow>(),
    supabase
      .from("rounds")
      .select("locks_at")
      .eq("stage", "group")
      .maybeSingle<RoundRow>(),
  ]);

  const teams = (teamsRes.data ?? []) as TeamRow[];
  const initial = specialRes.data ?? null;
  const lockAt = roundRes.data?.locks_at ?? null;
  const isLocked = lockAt ? new Date(lockAt) <= new Date() : false;

  return (
    <SpecialForm
      teams={teams}
      players={players}
      initial={initial}
      isLocked={isLocked}
      lockAt={lockAt}
    />
  );
}

async function fetchAllPlayers(
  supabase: SupabaseClient<Database>,
): Promise<PlayerRow[]> {
  const all: PlayerRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("players")
      .select(
        `id, name, position, jersey_number,
         team:teams!team_id(fifa_code, flag_url)`,
      )
      .eq("is_in_official_roster", true)
      .order("name")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as unknown as PlayerRow[]));
    if (data.length < PAGE) break;
  }
  return all;
}
