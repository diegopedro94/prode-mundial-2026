import { Radio } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teamName } from "@/lib/teams/i18n";

import { AutoRefresh } from "./auto-refresh";

// The live page is intentionally short-cache: data only refreshes from the
// every-5-min cron, but as the user opens the page mid-match we want a fresh
// read each time.
export const dynamic = "force-dynamic";

type Team = { id: number; name: string; fifa_code: string; flag_url: string | null };

type Match = {
  id: number;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
  group_letter: string | null;
  scheduled_at: string;
  status: "scheduled" | "live" | "finished";
  home_score: number | null;
  away_score: number | null;
  went_to_penalties: boolean;
  pk_winner_team_id: number | null;
  home_team: Team | null;
  away_team: Team | null;
};

type Goal = {
  id: number;
  match_id: number;
  minute: number | null;
  is_penalty: boolean;
  is_own_goal: boolean;
  team_id: number;
  player: { name: string; jersey_number: number | null } | null;
};

type Prediction = {
  match_id: number;
  home_score: number;
  away_score: number;
  points: number | null;
};

const TZ = "America/Argentina/Buenos_Aires";

export default async function LivePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  // Spec: live matches up top, then matches finished within the last 24h so
  // users can review what they got right after the final whistle. Avoid
  // showing the whole already-played history — that lives in /me and
  // /leaderboard already.
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: matchesData }, { data: predData }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `id, stage, group_letter, scheduled_at, status,
         home_score, away_score, went_to_penalties, pk_winner_team_id,
         home_team:home_team_id(id, name, fifa_code, flag_url),
         away_team:away_team_id(id, name, fifa_code, flag_url)`,
      )
      .or(`status.eq.live,and(status.eq.finished,scheduled_at.gte.${cutoff})`)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score, points")
      .eq("user_id", userId),
  ]);

  const matches = (matchesData ?? []) as unknown as Match[];
  const predsByMatch = new Map<number, Prediction>(
    ((predData ?? []) as Prediction[]).map((p) => [p.match_id, p]),
  );

  let goals: Goal[] = [];
  if (matches.length > 0) {
    const ids = matches.map((m) => m.id);
    const { data: goalsData } = await supabase
      .from("goals")
      .select(
        `id, match_id, minute, is_penalty, is_own_goal, team_id,
         player:players!player_id(name, jersey_number)`,
      )
      .in("match_id", ids)
      .order("minute", { nullsFirst: false });
    goals = (goalsData ?? []) as unknown as Goal[];
  }
  const goalsByMatch = new Map<number, Goal[]>();
  for (const g of goals) {
    const arr = goalsByMatch.get(g.match_id) ?? [];
    arr.push(g);
    goalsByMatch.set(g.match_id, arr);
  }

  const liveMatches = matches.filter((m) => m.status === "live");
  const finishedMatches = matches.filter((m) => m.status === "finished");

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            En vivo
          </h1>
          {liveMatches.length > 0 ? <LiveDot /> : null}
        </div>
        <AutoRefresh intervalMs={30_000} />
      </header>

      {liveMatches.length === 0 && finishedMatches.length === 0 ? (
        <EmptyState />
      ) : null}

      {liveMatches.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ahora ({liveMatches.length})
          </h2>
          <div className="space-y-3">
            {liveMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                goals={goalsByMatch.get(m.id) ?? []}
                myPrediction={predsByMatch.get(m.id) ?? null}
                kind="live"
              />
            ))}
          </div>
        </div>
      ) : null}

      {finishedMatches.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Terminados recientemente ({finishedMatches.length})
          </h2>
          <div className="space-y-3">
            {finishedMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                goals={goalsByMatch.get(m.id) ?? []}
                myPrediction={predsByMatch.get(m.id) ?? null}
                kind="finished"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
      <Radio className="mx-auto h-8 w-8 text-muted-foreground/40" />
      <p className="mt-3 text-sm text-muted-foreground">
        No hay partidos en vivo ni terminados en las últimas 24h.
      </p>
    </div>
  );
}

function MatchCard({
  match,
  goals,
  myPrediction,
  kind,
}: {
  match: Match;
  goals: Goal[];
  myPrediction: Prediction | null;
  kind: "live" | "finished";
}) {
  const homeName = teamName(match.home_team?.fifa_code, match.home_team?.name ?? "—");
  const awayName = teamName(match.away_team?.fifa_code, match.away_team?.name ?? "—");
  const stageLabel = match.stage === "group" ? `Grupo ${match.group_letter ?? ""}` : labelForStage(match.stage);
  const kickoff = new Date(match.scheduled_at).toLocaleTimeString("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Date(match.scheduled_at).toLocaleDateString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  });

  const homeGoals = goals.filter((g) => g.team_id === match.home_team?.id);
  const awayGoals = goals.filter((g) => g.team_id === match.away_team?.id);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>{stageLabel}</span>
        <span className="flex items-center gap-2">
          <span>
            {date} · {kickoff}
          </span>
          {kind === "live" ? <LiveBadge /> : <FinishedBadge />}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4">
        <TeamBlock team={match.home_team} label={homeName} align="right" />
        <Score
          home={match.home_score}
          away={match.away_score}
          wentToPk={match.went_to_penalties}
          pkWinnerTeamId={match.pk_winner_team_id}
          homeTeamId={match.home_team?.id ?? null}
        />
        <TeamBlock team={match.away_team} label={awayName} align="left" />
      </div>

      {goals.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 border-t border-border bg-muted/20 px-4 py-3 text-xs">
          <GoalsCol scorers={homeGoals} align="right" />
          <GoalsCol scorers={awayGoals} align="left" />
        </div>
      ) : null}

      {myPrediction ? (
        <PredictionFooter match={match} pred={myPrediction} kind={kind} />
      ) : (
        <p className="border-t border-border px-4 py-2 text-xs italic text-muted-foreground">
          No cargaste predicción para este partido.
        </p>
      )}
    </article>
  );
}

function TeamBlock({
  team,
  label,
  align,
}: {
  team: Team | null;
  label: string;
  align: "left" | "right";
}) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" ? <Flag flag={team?.flag_url ?? null} size="lg" /> : null}
      <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
        <div className="truncate text-sm font-semibold">{label}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {team?.fifa_code ?? "—"}
        </div>
      </div>
      {align === "right" ? <Flag flag={team?.flag_url ?? null} size="lg" /> : null}
    </div>
  );
}

function Score({
  home,
  away,
  wentToPk,
  pkWinnerTeamId,
  homeTeamId,
}: {
  home: number | null;
  away: number | null;
  wentToPk: boolean;
  pkWinnerTeamId: number | null;
  homeTeamId: number | null;
}) {
  const homeWonPk =
    wentToPk && pkWinnerTeamId !== null && homeTeamId !== null && pkWinnerTeamId === homeTeamId;
  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-2 font-mono text-3xl font-bold tabular-nums">
        <span>{home ?? "—"}</span>
        <span className="text-muted-foreground">·</span>
        <span>{away ?? "—"}</span>
      </div>
      {wentToPk ? (
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Penales: {homeWonPk ? "gana local" : "gana visitante"}
        </div>
      ) : null}
    </div>
  );
}

function GoalsCol({ scorers, align }: { scorers: Goal[]; align: "left" | "right" }) {
  if (scorers.length === 0) {
    return <div className={align === "right" ? "text-right text-muted-foreground/60" : "text-muted-foreground/60"}>—</div>;
  }
  return (
    <ul className={`space-y-1 ${align === "right" ? "text-right" : "text-left"}`}>
      {scorers.map((g) => (
        <li key={g.id} className="leading-tight">
          <span className="font-medium">{g.player?.name ?? "—"}</span>
          {g.minute != null ? (
            <span className="ml-1 font-mono text-muted-foreground">{g.minute}&apos;</span>
          ) : null}
          {g.is_penalty ? <span className="ml-1 text-muted-foreground">(p)</span> : null}
          {g.is_own_goal ? <span className="ml-1 text-muted-foreground">(EC)</span> : null}
        </li>
      ))}
    </ul>
  );
}

function PredictionFooter({
  match,
  pred,
  kind,
}: {
  match: Match;
  pred: Prediction;
  kind: "live" | "finished";
}) {
  const exact =
    kind === "finished" &&
    match.home_score === pred.home_score &&
    match.away_score === pred.away_score;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-4 py-2 text-xs">
      <span className="text-muted-foreground">
        Tu predicción:{" "}
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {pred.home_score} - {pred.away_score}
        </span>
      </span>
      {kind === "finished" ? (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums ${
            (pred.points ?? 0) > 0
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          }`}
        >
          {pred.points ?? 0} pts
          {exact ? <span>· exacto</span> : null}
        </span>
      ) : (
        <span className="text-muted-foreground">se calcula al terminar</span>
      )}
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
    </span>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-800 dark:bg-rose-950 dark:text-rose-200">
      <LiveDot />
      en vivo
    </span>
  );
}

function FinishedBadge() {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
      final
    </span>
  );
}

function Flag({ flag, size = "md" }: { flag: string | null; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-6 w-8" : "h-3 w-4";
  if (!flag) return <span className={`${cls} inline-block rounded-sm bg-muted`} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={flag} alt="" className={`${cls} rounded-sm object-cover ring-1 ring-border`} loading="lazy" />
  );
}

function labelForStage(stage: Match["stage"]): string {
  return (
    {
      group: "Grupos",
      r32: "Ronda de 32",
      r16: "Octavos",
      qf: "Cuartos",
      sf: "Semifinales",
      third_place: "Tercer puesto",
      final: "Final",
    } as const
  )[stage];
}
