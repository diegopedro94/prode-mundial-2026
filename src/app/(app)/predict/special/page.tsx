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
  firstname: string | null;
  lastname: string | null;
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

  const [teamsRes, playersRes, specialRes, roundRes] = await Promise.all([
    supabase.from("teams").select("id, name, fifa_code, flag_url").order("name"),
    supabase
      .from("players")
      .select(
        `id, name, firstname, lastname, position, jersey_number,
         team:teams!team_id(fifa_code, flag_url)`,
      )
      .eq("is_in_official_roster", true)
      .order("name"),
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
  const players = (playersRes.data ?? []) as unknown as PlayerRow[];
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
