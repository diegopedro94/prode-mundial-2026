"use server";

import { revalidatePath } from "next/cache";

import type { TablesUpdate } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadTeamExternalIndex, syncGoalsForFixture } from "@/lib/sync/goals";

import {
  allowedEmailSchema,
  goalSchema,
  matchResultSchema,
  roundLockSchema,
  type AllowedEmailInput,
  type GoalInput,
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

export async function addMatchGoal(input: GoalInput): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const supabase = await createSupabaseServerClient();

  // The team_id stored on the goal must match the player's team so the
  // per-team stats (and the future "did Brasil score?" widgets) stay
  // consistent. Resolve it here instead of trusting the client.
  const { data: player, error: playerErr } = await supabase
    .from("players")
    .select("team_id")
    .eq("id", parsed.data.playerId)
    .maybeSingle<{ team_id: number }>();
  if (playerErr || !player) {
    return { ok: false, error: "Jugador inexistente" };
  }

  const { error } = await supabase.from("goals").insert({
    match_id: parsed.data.matchId,
    player_id: parsed.data.playerId,
    team_id: player.team_id,
    minute: parsed.data.minute,
    is_penalty: parsed.data.isPenalty,
    is_own_goal: parsed.data.isOwnGoal,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/matches/${parsed.data.matchId}`);
  revalidatePath("/admin/top-scorers");
  return { ok: true };
}

export async function deleteMatchGoal(goalId: number): Promise<ActionResult> {
  if (!Number.isFinite(goalId) || goalId <= 0) {
    return { ok: false, error: "goalId inválido" };
  }
  const supabase = await createSupabaseServerClient();
  // Capture matchId so we know which path to revalidate.
  const { data: goal } = await supabase
    .from("goals")
    .select("match_id")
    .eq("id", goalId)
    .maybeSingle<{ match_id: number }>();
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) return { ok: false, error: error.message };
  if (goal?.match_id) revalidatePath(`/admin/matches/${goal.match_id}`);
  revalidatePath("/admin/top-scorers");
  return { ok: true };
}

export async function refreshMatchGoals(
  matchId: number,
): Promise<ActionResult & { inserted?: number }> {
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return { ok: false, error: "matchId inválido" };
  }
  // Admin gate.
  const userClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión" };
  const { data: profile } = await userClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (!profile?.is_admin) return { ok: false, error: "Solo admins" };

  // Resolve external_id, then call the shared goals sync with force=true so
  // it overrides whatever we had on file (api-football sometimes publishes
  // corrected scorers hours after the final whistle).
  const admin = createSupabaseAdminClient();
  const { data: match } = await admin
    .from("matches")
    .select("external_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match?.external_id) {
    return { ok: false, error: "El partido no tiene external_id de api-football" };
  }

  try {
    const teams = await loadTeamExternalIndex(admin);
    const r = await syncGoalsForFixture(admin, match.external_id, teams, {
      force: true,
    });
    revalidatePath(`/admin/matches/${matchId}`);
    revalidatePath("/admin/top-scorers");
    return { ok: true, inserted: r.inserted };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function saveMatchSummaryIntro(
  matchId: number,
  intro: string,
): Promise<ActionResult> {
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return { ok: false, error: "matchId inválido" };
  }
  // Cap to avoid storing huge blobs; the intro is meant to be a paragraph.
  const trimmed = intro.length > 2000 ? intro.slice(0, 2000) : intro;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("matches")
    .update({ summary_intro: trimmed })
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/matches/${matchId}`);
  return { ok: true };
}

export async function lockAllRosters(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión" };

  const { error, count } = await supabase
    .from("players")
    .update({ is_in_official_roster: true }, { count: "exact" })
    .neq("is_in_official_roster", true);
  if (error) return { ok: false, error: error.message };

  // Stamp the audit log so it's visible in /admin/audit who locked.
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "rosters.lock",
    entity: "players",
    entity_id: null,
    before: null,
    after: { locked_count: count ?? null },
  });

  revalidatePath("/admin/rosters");
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
