import { Sparkles } from "lucide-react";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teamName } from "@/lib/teams/i18n";

type Team = { id: number; name: string; fifa_code: string; flag_url: string | null };

type MatchRow = {
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

type PredictionRow = {
  user_id: string;
  home_score: number;
  away_score: number;
  pk_winner_team_id: number | null;
  points: number | null;
  profile: { display_name: string; avatar_url: string | null } | null;
};

const TZ = "America/Argentina/Buenos_Aires";

const STAGE_LABEL: Record<MatchRow["stage"], string> = {
  group: "Fase de grupos",
  r32: "Ronda de 32",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinales",
  third_place: "Tercer puesto",
  final: "Final",
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isFinite(matchId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user!.id;

  const { data: matchData } = await supabase
    .from("matches")
    .select(
      `id, stage, group_letter, scheduled_at, status, home_score, away_score,
       went_to_penalties, pk_winner_team_id,
       home_team:home_team_id(id, name, fifa_code, flag_url),
       away_team:away_team_id(id, name, fifa_code, flag_url)`,
    )
    .eq("id", matchId)
    .maybeSingle();
  const match = (matchData ?? null) as unknown as MatchRow | null;
  if (!match || !match.home_team || !match.away_team) notFound();

  const { data: predsData } = await supabase
    .from("predictions")
    .select(
      `user_id, home_score, away_score, pk_winner_team_id, points,
       profile:profiles!user_id(display_name, avatar_url)`,
    )
    .eq("match_id", matchId);
  const predictions = (predsData ?? []) as unknown as PredictionRow[];

  const kickoffPassed = new Date(match.scheduled_at) <= new Date();
  const myPrediction = predictions.find((p) => p.user_id === meId) ?? null;
  const othersPredictions = predictions
    .filter((p) => p.user_id !== meId)
    .sort((a, b) => (b.points ?? -1) - (a.points ?? -1));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>
          {STAGE_LABEL[match.stage]}
          {match.group_letter ? ` · Grupo ${match.group_letter}` : ""}
        </span>
        {match.status === "live" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            en curso
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="bg-gradient-to-b from-primary/5 to-transparent px-6 py-6">
          <p className="text-center text-sm text-muted-foreground">
            {new Date(match.scheduled_at).toLocaleString("es-AR", {
              timeZone: TZ,
              weekday: "long",
              day: "2-digit",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            <TeamHero team={match.home_team} side="home" winner={match.status === "finished" && (match.home_team.id === (match.went_to_penalties ? match.pk_winner_team_id : (match.home_score ?? 0) > (match.away_score ?? 0) ? match.home_team.id : null))} />
            <ScoreDisplay match={match} />
            <TeamHero team={match.away_team} side="away" winner={match.status === "finished" && (match.away_team.id === (match.went_to_penalties ? match.pk_winner_team_id : (match.away_score ?? 0) > (match.home_score ?? 0) ? match.away_team.id : null))} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Tu predicción
        </h2>
        {myPrediction ? (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <span className="font-mono text-2xl font-bold tabular-nums">
              {myPrediction.home_score} – {myPrediction.away_score}
            </span>
            {myPrediction.points != null ? (
              <PointsBadge value={myPrediction.points} />
            ) : (
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                pendiente
              </span>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            No cargaste predicción para este partido.
          </div>
        )}
      </div>

      {kickoffPassed ? (
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Predicciones de los demás
          </h2>
          {othersPredictions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Nadie más cargó predicción.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Jugador</th>
                    <th className="px-3 py-2 text-center">Pronóstico</th>
                    <th className="px-3 py-2 text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {othersPredictions.map((p) => {
                    const exact =
                      p.home_score === match.home_score &&
                      p.away_score === match.away_score;
                    return (
                      <tr
                        key={p.user_id}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <PredictionAvatar
                              name={p.profile?.display_name ?? "—"}
                              avatarUrl={p.profile?.avatar_url ?? null}
                            />
                            <span className="font-medium">
                              {p.profile?.display_name ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-mono tabular-nums">
                          {p.home_score} – {p.away_score}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {p.points != null ? (
                            <PointsBadge value={p.points} exact={exact} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Las predicciones de los demás se revelan al kickoff.
        </div>
      )}
    </section>
  );
}

function TeamHero({
  team,
  side,
  winner,
}: {
  team: Team;
  side: "home" | "away";
  winner: boolean;
}) {
  const isHome = side === "home";
  return (
    <div
      className={`flex flex-col items-center gap-2 ${isHome ? "" : ""} ${winner ? "" : "opacity-100"}`}
    >
      <Flag flagUrl={team.flag_url} />
      <div className="text-center">
        <div className="text-sm font-semibold sm:text-base">
          {teamName(team.fifa_code, team.name)}
        </div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {team.fifa_code}
        </div>
      </div>
    </div>
  );
}

function ScoreDisplay({ match }: { match: MatchRow }) {
  if (match.status === "finished") {
    return (
      <div className="text-center">
        <div className="font-mono text-4xl font-bold tabular-nums sm:text-5xl">
          {match.home_score} – {match.away_score}
        </div>
        {match.went_to_penalties ? (
          <div className="mt-1 text-xs text-muted-foreground">
            Gana penales{" "}
            <span className="font-semibold text-foreground">
              {match.pk_winner_team_id === match.home_team?.id
                ? match.home_team.fifa_code
                : match.pk_winner_team_id === match.away_team?.id
                  ? match.away_team.fifa_code
                  : "—"}
            </span>
          </div>
        ) : null}
        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          finalizado
        </div>
      </div>
    );
  }
  if (match.status === "live") {
    return (
      <div className="text-center">
        <div className="font-mono text-4xl font-bold tabular-nums sm:text-5xl">
          {match.home_score ?? "–"} – {match.away_score ?? "–"}
        </div>
        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          en curso
        </div>
      </div>
    );
  }
  return (
    <div className="text-3xl font-light text-muted-foreground sm:text-4xl">vs</div>
  );
}

function Flag({ flagUrl }: { flagUrl: string | null }) {
  if (!flagUrl) {
    return (
      <div className="h-12 w-16 rounded-md bg-muted ring-1 ring-foreground/10 sm:h-16 sm:w-24" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl}
      alt=""
      className="h-12 w-16 rounded-md object-cover shadow-sm ring-1 ring-foreground/10 sm:h-16 sm:w-24"
      loading="lazy"
    />
  );
}

function PointsBadge({ value, exact }: { value: number; exact?: boolean }) {
  if (exact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <Sparkles className="h-3 w-3" />
        {value} pts
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        {value} pts
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      0 pts
    </span>
  );
}

function PredictionAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border"
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
      {initials || "—"}
    </div>
  );
}
