import { Sparkles, Target, Trophy, TrendingUp, Calendar } from "lucide-react";

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

  const valid = rows.filter(
    (r): r is Row & { match: NonNullable<Row["match"]> } => r.match !== null,
  );

  const finished = valid.filter((r) => r.match.status === "finished");
  const totalPoints = finished.reduce((acc, r) => acc + (r.points ?? 0), 0);
  const exactCount = finished.filter(
    (r) =>
      r.home_score === r.match.home_score && r.away_score === r.match.away_score,
  ).length;
  const scoredCount = finished.filter((r) => (r.points ?? 0) > 0).length;
  const exactPct = finished.length === 0 ? 0 : (exactCount / finished.length) * 100;

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
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Mi prode
        </h1>
        <p className="text-sm text-muted-foreground">{displayName}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Trophy className="h-4 w-4" />}
          label="Puntos totales"
          value={String(totalPoints)}
          accent="text-amber-600 dark:text-amber-400"
        />
        <Stat
          icon={<Calendar className="h-4 w-4" />}
          label="Predicciones"
          value={`${valid.length}`}
          hint={`de 104 partidos`}
          accent="text-blue-600 dark:text-blue-400"
        />
        <Stat
          icon={<Target className="h-4 w-4" />}
          label="Scores exactos"
          value={String(exactCount)}
          accent="text-rose-600 dark:text-rose-400"
        />
        <Stat
          icon={<TrendingUp className="h-4 w-4" />}
          label="% aciertos"
          value={finished.length === 0 ? "—" : `${exactPct.toFixed(1)}%`}
          hint={`${scoredCount} acertados / ${finished.length} jugados`}
          accent="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {finished.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Las estadísticas aparecen cuando empiezan a jugarse partidos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <DayList
            title="Mejores jornadas"
            days={bestDays}
            accent="emerald"
          />
          <DayList
            title="Peores jornadas"
            days={worstDays}
            accent="zinc"
          />
        </div>
      )}

      {valid.length > 0 ? (
        <details className="rounded-2xl border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between">
              <span>Tus predicciones</span>
              <span className="text-xs text-muted-foreground">
                {finished.length} finalizadas · {scoredCount} con puntos
              </span>
            </div>
          </summary>
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Partido</th>
                  <th className="px-3 py-2 text-center">Tu</th>
                  <th className="px-3 py-2 text-center">Real</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {finished
                  .sort(
                    (a, b) =>
                      new Date(b.match.scheduled_at).getTime() -
                      new Date(a.match.scheduled_at).getTime(),
                  )
                  .map((r) => {
                    const isExact =
                      r.home_score === r.match.home_score &&
                      r.away_score === r.match.away_score;
                    return (
                      <tr
                        key={r.match_id}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {localDate(r.match.scheduled_at)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.match.home_team?.fifa_code} vs{" "}
                          {r.match.away_team?.fifa_code}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {r.home_score}-{r.away_score}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {r.match.home_score}-{r.match.away_score}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <PointsBadge value={r.points ?? 0} exact={isExact} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted ${accent}`}>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function DayList({
  title,
  days,
  accent,
}: {
  title: string;
  days: [string, number][];
  accent: "emerald" | "zinc";
}) {
  const tints = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    zinc: "text-muted-foreground",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm">
        {days.map(([date, points]) => (
          <li key={date} className="flex items-center justify-between">
            <span className="capitalize">{date}</span>
            <span className={`font-mono font-semibold tabular-nums ${tints[accent]}`}>
              {points} pts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PointsBadge({ value, exact }: { value: number; exact: boolean }) {
  if (exact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <Sparkles className="h-3 w-3" />
        {value}
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        {value}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      0
    </span>
  );
}
