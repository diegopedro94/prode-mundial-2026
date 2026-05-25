import { createSupabaseServerClient } from "@/lib/supabase/server";

type Row = {
  match_id: number;
  home_score: number;
  away_score: number;
  points: number | null;
  match: {
    id: number;
    scheduled_at: string;
    status: "scheduled" | "live" | "finished";
    stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
    home_score: number | null;
    away_score: number | null;
    home_team: { fifa_code: string; name: string } | null;
    away_team: { fifa_code: string; name: string } | null;
  } | null;
};

const TZ = "America/Argentina/Buenos_Aires";

function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  });
}

export default async function MePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle<{ display_name: string }>();
  const displayName = profileData?.display_name ?? "—";

  const { data: predsData } = await supabase
    .from("predictions")
    .select(
      `match_id, home_score, away_score, points,
       match:matches!match_id(id, scheduled_at, status, stage, home_score, away_score,
         home_team:home_team_id(fifa_code, name),
         away_team:away_team_id(fifa_code, name))`,
    )
    .eq("user_id", userId);
  const rows = (predsData ?? []) as unknown as Row[];

  const valid = rows.filter((r): r is Row & { match: NonNullable<Row["match"]> } => r.match !== null);

  const finished = valid.filter((r) => r.match.status === "finished");
  const totalPoints = finished.reduce((acc, r) => acc + (r.points ?? 0), 0);
  const exactCount = finished.filter(
    (r) =>
      r.home_score === r.match.home_score && r.away_score === r.match.away_score,
  ).length;
  const scoredCount = finished.filter((r) => (r.points ?? 0) > 0).length;
  const exactPct = finished.length === 0 ? 0 : (exactCount / finished.length) * 100;

  // Best/worst day (sum of points per local date, considering only finished matches).
  const byDate = new Map<string, number>();
  for (const r of finished) {
    const key = localDate(r.match.scheduled_at);
    byDate.set(key, (byDate.get(key) ?? 0) + (r.points ?? 0));
  }
  const days = [...byDate.entries()].sort((a, b) => b[1] - a[1]);
  const bestDays = days.slice(0, 3);
  const worstDays = days.slice(-3).reverse();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Mi prode — {displayName}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tus n&uacute;meros del Mundial 2026.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Puntos totales" value={String(totalPoints)} />
        <Stat label="Predicciones cargadas" value={`${valid.length} / 104`} />
        <Stat label="Scores exactos" value={String(exactCount)} />
        <Stat
          label="% aciertos"
          value={finished.length === 0 ? "—" : `${exactPct.toFixed(1)}%`}
          hint={`${exactCount} de ${finished.length} finalizados`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DayList title="Mejores jornadas" days={bestDays} emptyLabel="Sin partidos jugados todavía." />
        <DayList title="Peores jornadas" days={worstDays} emptyLabel="Sin partidos jugados todavía." />
      </div>

      <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer text-sm font-medium">
          Tus predicciones ({finished.length} finalizadas, {scoredCount} con puntos)
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-2 py-1">Fecha</th>
                <th className="px-2 py-1">Partido</th>
                <th className="px-2 py-1 text-center">Tu</th>
                <th className="px-2 py-1 text-center">Real</th>
                <th className="px-2 py-1 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {finished
                .sort(
                  (a, b) =>
                    new Date(b.match.scheduled_at).getTime() -
                    new Date(a.match.scheduled_at).getTime(),
                )
                .map((r) => (
                  <tr key={r.match_id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-2 py-1 font-mono text-xs text-zinc-500">
                      {localDate(r.match.scheduled_at)}
                    </td>
                    <td className="px-2 py-1 text-xs">
                      {r.match.home_team?.fifa_code} vs {r.match.away_team?.fifa_code}
                    </td>
                    <td className="px-2 py-1 text-center font-mono">
                      {r.home_score}-{r.away_score}
                    </td>
                    <td className="px-2 py-1 text-center font-mono">
                      {r.match.home_score}-{r.match.away_score}
                    </td>
                    <td className="px-2 py-1 text-right font-mono font-semibold">
                      {r.points ?? 0}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function DayList({
  title,
  days,
  emptyLabel,
}: {
  title: string;
  days: [string, number][];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-medium">{title}</div>
      {days.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {days.map(([date, points]) => (
            <li key={date} className="flex items-center justify-between">
              <span>{date}</span>
              <span className="font-mono font-semibold">{points} pts</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
