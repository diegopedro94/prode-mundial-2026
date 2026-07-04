import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { KnockoutBoard } from "./knockout-board";

type DbStage = "r32" | "r16" | "qf" | "sf" | "third_place" | "final";

// URL slug ↔ DB stage. The slug "third" reads better than "third_place".
const SLUG_TO_STAGE: Record<string, DbStage> = {
  r32: "r32",
  r16: "r16",
  qf: "qf",
  sf: "sf",
  third: "third_place",
  final: "final",
};

const STAGE_LABEL: Record<DbStage, string> = {
  r32: "16vos de final",
  r16: "8vos de final",
  qf: "Cuartos de final",
  sf: "Semifinales",
  third_place: "Tercer puesto",
  final: "Final",
};

type MatchRow = {
  id: number;
  scheduled_at: string;
  locks_at: string | null;
  home_team: { id: number; name: string; fifa_code: string; flag_url: string | null } | null;
  away_team: { id: number; name: string; fifa_code: string; flag_url: string | null } | null;
};

type PredictionRow = {
  match_id: number;
  home_score: number;
  away_score: number;
  pk_winner_team_id: number | null;
};

type RoundRow = { locks_at: string };

export default async function PredictStagePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage: slug } = await params;
  const stage = SLUG_TO_STAGE[slug];
  if (!stage) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const [matchesRes, predictionsRes, roundRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `id, scheduled_at, locks_at,
         home_team:home_team_id(id, name, fifa_code, flag_url),
         away_team:away_team_id(id, name, fifa_code, flag_url)`,
      )
      .eq("stage", stage)
      .order("scheduled_at"),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score, pk_winner_team_id")
      .eq("user_id", userId),
    supabase
      .from("rounds")
      .select("locks_at")
      .eq("stage", stage)
      .maybeSingle<RoundRow>(),
  ]);

  const matches = (matchesRes.data ?? []) as unknown as MatchRow[];
  const predictions = (predictionsRes.data ?? []) as PredictionRow[];
  const roundLockAt = roundRes.data?.locks_at ?? null;
  const now = new Date();
  const isLocked = roundLockAt ? new Date(roundLockAt) <= now : false;

  const predictionByMatch = new Map(predictions.map((p) => [p.match_id, p]));

  return (
    <KnockoutBoard
      stageLabel={STAGE_LABEL[stage]}
      matches={matches.map((m) => ({
        id: m.id,
        scheduledAt: m.scheduled_at,
        // Effective lock is match.locks_at when set, otherwise the round's.
        // Kickoff acts as a secondary hard stop even when the lock is later.
        lockAt: m.locks_at ?? roundLockAt,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        prediction: predictionByMatch.get(m.id) ?? null,
      }))}
      isLocked={isLocked}
      lockAt={roundLockAt}
    />
  );
}
