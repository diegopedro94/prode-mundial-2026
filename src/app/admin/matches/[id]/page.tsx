import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  buildMatchSummary,
  type SummaryPrediction,
} from "@/lib/admin/match-summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teamName } from "@/lib/teams/i18n";

import { GoalsEditor } from "./goals-editor";
import { RefreshGoalsButton } from "./refresh-goals-button";
import { SummaryEditor } from "./summary-editor";

type Team = { id: number; name: string; fifa_code: string; flag_url: string | null };

type MatchRow = {
  id: number;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
  scheduled_at: string;
  status: "scheduled" | "live" | "finished";
  home_score: number | null;
  away_score: number | null;
  summary_intro: string | null;
  home_team: Team | null;
  away_team: Team | null;
};

type PredictionDB = {
  user_id: string;
  home_score: number;
  away_score: number;
  pk_winner_team_id: number | null;
  profile: { display_name: string } | null;
};

const TZ = "America/Argentina/Buenos_Aires";

export default async function AdminMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isFinite(matchId)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: matchData } = await supabase
    .from("matches")
    .select(
      `id, stage, scheduled_at, status, home_score, away_score, summary_intro,
       home_team:home_team_id(id, name, fifa_code, flag_url),
       away_team:away_team_id(id, name, fifa_code, flag_url)`,
    )
    .eq("id", matchId)
    .maybeSingle();
  const match = matchData as unknown as MatchRow | null;
  if (!match || !match.home_team || !match.away_team) notFound();

  // RLS allows admins to read all predictions regardless of kickoff time.
  const { data: predsData } = await supabase
    .from("predictions")
    .select(
      `user_id, home_score, away_score, pk_winner_team_id,
       profile:profiles!user_id(display_name)`,
    )
    .eq("match_id", matchId);
  const rawPreds = (predsData ?? []) as unknown as PredictionDB[];
  const predictions: SummaryPrediction[] = rawPreds.map((p) => ({
    home_score: p.home_score,
    away_score: p.away_score,
    pk_winner_team_id: p.pk_winner_team_id,
    display_name: p.profile?.display_name ?? "—",
  }));

  // Existing goals + the rosters of both teams (for the add-goal selector).
  const [{ data: goalsData }, { data: rosterData }] = await Promise.all([
    supabase
      .from("goals")
      .select(
        `id, minute, is_penalty, is_own_goal,
         player:players!player_id(id, name, jersey_number, position),
         team:teams!team_id(id, fifa_code, name, flag_url)`,
      )
      .eq("match_id", matchId)
      .order("minute", { nullsFirst: false }),
    supabase
      .from("players")
      .select("id, name, jersey_number, position, team_id")
      .in("team_id", [match.home_team.id, match.away_team.id])
      .order("name"),
  ]);

  type GoalRow = {
    id: number;
    minute: number | null;
    is_penalty: boolean;
    is_own_goal: boolean;
    player: { id: number; name: string; jersey_number: number | null; position: string | null } | null;
    team: { id: number; fifa_code: string; name: string; flag_url: string | null } | null;
  };
  type RosterPlayer = {
    id: number;
    name: string;
    jersey_number: number | null;
    position: "GK" | "DEF" | "MID" | "FWD" | null;
    team_id: number;
  };
  const goals = ((goalsData ?? []) as unknown as GoalRow[]).filter(
    (g): g is GoalRow & { player: NonNullable<GoalRow["player"]>; team: NonNullable<GoalRow["team"]> } => g.player != null && g.team != null,
  );
  const roster = (rosterData ?? []) as RosterPlayer[];

  const isKnockout = match.stage !== "group";

  // Build the read-only "auto" portion that the editor will combine with the
  // (live-edited) intro from the client component.
  const autoBody = buildMatchSummary({
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    predictions,
    intro: null,
    isKnockout,
  });

  const kickoff = new Date(match.scheduled_at).toLocaleString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const homeName = teamName(match.home_team.fifa_code, match.home_team.name);
  const awayName = teamName(match.away_team.fifa_code, match.away_team.name);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/admin/matches"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a partidos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {homeName} <span className="text-muted-foreground">vs</span> {awayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {kickoff} · {predictions.length} predicción
              {predictions.length === 1 ? "" : "es"} cargada
              {predictions.length === 1 ? "" : "s"}
            </p>
          </div>
          {match.status === "finished" ? (
            <RefreshGoalsButton matchId={match.id} />
          ) : null}
        </div>
      </header>

      <GoalsEditor
        matchId={match.id}
        homeTeam={{
          id: match.home_team.id,
          name: homeName,
          fifa_code: match.home_team.fifa_code,
        }}
        awayTeam={{
          id: match.away_team.id,
          name: awayName,
          fifa_code: match.away_team.fifa_code,
        }}
        goals={goals.map((g) => ({
          id: g.id,
          minute: g.minute,
          is_penalty: g.is_penalty,
          is_own_goal: g.is_own_goal,
          player_id: g.player.id,
          player_name: g.player.name,
          jersey_number: g.player.jersey_number,
          team_id: g.team.id,
        }))}
        roster={roster}
      />


      <SummaryEditor
        matchId={match.id}
        initialIntro={match.summary_intro ?? ""}
        autoBody={autoBody}
        kickoffPassed={new Date(match.scheduled_at) <= new Date()}
      />
    </section>
  );
}
