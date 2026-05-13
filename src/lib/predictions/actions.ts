"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";

import {
  predictionSchema,
  specialSchema,
  type PredictionInput,
  type SpecialInput,
} from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function upsertPrediction(input: PredictionInput): Promise<ActionResult> {
  const parsed = predictionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { matchId, homeScore, awayScore, pkWinnerTeamId } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión" };

  const row: TablesInsert<"predictions"> = {
    user_id: user.id,
    match_id: matchId,
    home_score: homeScore,
    away_score: awayScore,
    pk_winner_team_id: pkWinnerTeamId ?? null,
  };
  const { error } = await supabase
    .from("predictions")
    .upsert(row, { onConflict: "user_id,match_id" });
  if (error) {
    // RLS denial typically surfaces here when the round is locked.
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function upsertSpecial(input: SpecialInput): Promise<ActionResult> {
  const parsed = specialSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión" };

  const row: TablesInsert<"special_predictions"> = {
    user_id: user.id,
    champion_team_id: parsed.data.championTeamId ?? null,
    runner_up_team_id: parsed.data.runnerUpTeamId ?? null,
    top_scorer_player_id: parsed.data.topScorerPlayerId ?? null,
    mvp_player_id: parsed.data.mvpPlayerId ?? null,
    best_gk_player_id: parsed.data.bestGkPlayerId ?? null,
  };
  const { error } = await supabase.from("special_predictions").upsert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
