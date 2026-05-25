import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  profile: { display_name: string } | null;
};

const TZ = "America/Argentina/Buenos_Aires";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  // RLS filters predictions: pre-kickoff this returns only own; post-kickoff
  // it returns everyone's.
  const { data: predsData } = await supabase
    .from("predictions")
    .select(
      `user_id, home_score, away_score, pk_winner_team_id, points,
       profile:profiles!user_id(display_name)`,
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
      <header className="text-xs uppercase tracking-wider text-zinc-500">
        {STAGE_LABEL[match.stage]}
        {match.group_letter ? ` · Grupo ${match.group_letter}` : ""}
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-center text-sm text-zinc-500">{fmt(match.scheduled_at)}</div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <TeamBlock team={match.home_team} />
          <div className="text-center">
            {match.status === "finished" ? (
              <>
                <div className="text-4xl font-bold tracking-tight">
                  {match.home_score} – {match.away_score}
                </div>
                {match.went_to_penalties ? (
                  <div className="mt-1 text-xs text-zinc-500">
                    Penales: gan&oacute;{" "}
                    {match.pk_winner_team_id === match.home_team.id
                      ? match.home_team.fifa_code
                      : match.pk_winner_team_id === match.away_team.id
                        ? match.away_team.fifa_code
                        : "—"}
                  </div>
                ) : null}
                <div className="mt-1 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  finalizado
                </div>
              </>
            ) : match.status === "live" ? (
              <>
                <div className="text-4xl font-bold tracking-tight">
                  {match.home_score ?? "—"} – {match.away_score ?? "—"}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  en curso
                </div>
              </>
            ) : (
              <div className="text-2xl text-zinc-400">vs</div>
            )}
          </div>
          <TeamBlock team={match.away_team} side="right" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Tu predicci&oacute;n
        </h2>
        {myPrediction ? (
          <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg">
                {myPrediction.home_score} – {myPrediction.away_score}
              </span>
              {myPrediction.points != null ? (
                <PointsBadge value={myPrediction.points} />
              ) : (
                <span className="text-xs text-zinc-500">a resolver</span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No cargaste predicci&oacute;n para este partido.</p>
        )}
      </div>

      {kickoffPassed ? (
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Predicciones de los dem&aacute;s
          </h2>
          {othersPredictions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Nadie m&aacute;s carg&oacute; predicci&oacute;n.</p>
          ) : (
            <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">Jugador</th>
                    <th className="px-3 py-2 text-center">Pron&oacute;stico</th>
                    <th className="px-3 py-2 text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {othersPredictions.map((p) => (
                    <tr
                      key={p.user_id}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="px-3 py-2 font-medium">
                        {p.profile?.display_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center font-mono">
                        {p.home_score} – {p.away_score}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.points != null ? (
                          <PointsBadge value={p.points} />
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Las predicciones de los dem&aacute;s se revelan al kickoff.
        </p>
      )}
    </section>
  );
}

function TeamBlock({ team, side = "left" }: { team: Team; side?: "left" | "right" }) {
  const align = side === "right" ? "text-left" : "text-right";
  return (
    <div className={`flex items-center gap-3 ${side === "right" ? "" : "flex-row-reverse"}`}>
      {team.flag_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.flag_url}
          alt=""
          className="h-8 w-12 rounded-sm object-cover"
          width={48}
          height={32}
        />
      ) : null}
      <div className={align}>
        <div className="font-semibold">{team.name}</div>
        <div className="text-xs text-zinc-500">{team.fifa_code}</div>
      </div>
    </div>
  );
}

function PointsBadge({ value }: { value: number }) {
  const tone =
    value >= 4
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : value > 0
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {value} pt{value === 1 ? "" : "s"}
    </span>
  );
}
