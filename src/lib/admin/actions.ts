"use server";

import { revalidatePath } from "next/cache";

import type { TablesUpdate } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  allowedEmailSchema,
  matchResultSchema,
  roundLockSchema,
  type AllowedEmailInput,
  type MatchResultInput,
  type RoundLockInput,
} from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setMatchResult(input: MatchResultInput): Promise<ActionResult> {
  const parsed = matchResultSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Compute winner_team_id from home/away score (+ pk_winner for knockout shootouts).
  // The scoring trigger reads `winner_team_id`, so it has to be set consistently.
  let winnerTeamId: number | null = null;
  if (v.status === "finished" && v.homeScore !== null && v.awayScore !== null) {
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, stage")
      .eq("id", v.matchId)
      .single();
    if (matchError) return { ok: false, error: matchError.message };
    if (!match || !match.home_team_id || !match.away_team_id) {
      return { ok: false, error: "Partido sin equipos asignados" };
    }
    if (v.homeScore > v.awayScore) winnerTeamId = match.home_team_id;
    else if (v.homeScore < v.awayScore) winnerTeamId = match.away_team_id;
    else if (v.wentToPenalties) winnerTeamId = v.pkWinnerTeamId;
    // else group-stage tie → winnerTeamId stays null
  }

  const update: TablesUpdate<"matches"> = {
    home_score: v.homeScore,
    away_score: v.awayScore,
    went_to_penalties: v.wentToPenalties,
    pk_winner_team_id: v.wentToPenalties ? v.pkWinnerTeamId : null,
    status: v.status,
    winner_team_id: winnerTeamId,
  };

  const { error } = await supabase.from("matches").update(update).eq("id", v.matchId);
  if (error) return { ok: false, error: error.message };

  // The audit trigger has already fired in Postgres. Refresh the page so the admin
  // sees the new values.
  revalidatePath("/admin/matches");
  return { ok: true };
}

export async function setRoundLock(input: RoundLockInput): Promise<ActionResult> {
  const parsed = roundLockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("rounds")
    .update({ locks_at: parsed.data.locksAt })
    .eq("stage", parsed.data.stage);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/rounds");
  return { ok: true };
}

export async function upsertAllowedEmail(
  input: AllowedEmailInput,
): Promise<ActionResult> {
  const parsed = allowedEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Email inválido" };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión" };

  const { error } = await supabase
    .from("allowed_emails")
    .upsert({
      email: parsed.data.email,
      is_admin: parsed.data.isAdmin,
      added_by: user.id,
    });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/allowed-emails");
  return { ok: true };
}

export async function removeAllowedEmail(email: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión" };

  // Sanity: don't let an admin delete their own row from the whitelist.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle<{ id: string }>();
  if (profile) {
    const { data: me } = await supabase.auth.getUser();
    if (me.user?.email?.toLowerCase() === email.toLowerCase()) {
      return { ok: false, error: "No te podés sacar a vos mismo de la whitelist." };
    }
  }

  const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/allowed-emails");
  return { ok: true };
}
