import { Trophy } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type LeaderRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  exact_count: number;
  scored_count: number;
  predictions_count: number;
};

const MEDAL_RING = [
  "ring-amber-400 bg-amber-50 text-amber-900 dark:ring-amber-500/60 dark:bg-amber-950/50 dark:text-amber-200",
  "ring-zinc-400 bg-zinc-100 text-zinc-900 dark:ring-zinc-500/60 dark:bg-zinc-800 dark:text-zinc-100",
  "ring-orange-400 bg-orange-50 text-orange-900 dark:ring-orange-500/60 dark:bg-orange-950/50 dark:text-orange-200",
];

export default async function LeaderboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user!.id;

  const { data, error } = await supabase.rpc("get_leaderboard");
  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </section>
    );
  }

  const rows = (data ?? []) as LeaderRow[];
  const leaderPoints = rows[0]?.total_points ?? 0;

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Ordenado por puntos. Desempate: cantidad de scores exactos. Los puntos se
          recalculan automáticamente cuando un partido pasa a finalizado.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no hay jugadores. Cuando alguien cargue al menos una predicción
            aparece acá.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const rank = i + 1;
            const isMe = r.user_id === meId;
            const widthPct =
              leaderPoints > 0 ? Math.max(8, (r.total_points / leaderPoints) * 100) : 8;
            return (
              <li
                key={r.user_id}
                className={`relative overflow-hidden rounded-2xl border bg-card shadow-sm transition ${
                  isMe ? "border-primary ring-1 ring-primary/30" : "border-border"
                }`}
              >
                {/* Progress bar bg */}
                <div
                  className="absolute inset-y-0 left-0 bg-primary/8 dark:bg-primary/20"
                  style={{ width: `${widthPct}%` }}
                  aria-hidden="true"
                />

                <div className="relative flex items-center gap-3 px-3 py-3 sm:px-4">
                  <Rank rank={rank} />
                  <Avatar name={r.display_name} avatarUrl={r.avatar_url} />

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{r.display_name}</span>
                      {isMe ? (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                          vos
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        <span className="font-mono font-medium text-foreground">
                          {r.exact_count}
                        </span>{" "}
                        exactos
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>
                        <span className="font-mono font-medium text-foreground">
                          {r.scored_count}
                        </span>{" "}
                        acertados
                      </span>
                      <span className="hidden text-muted-foreground/40 sm:inline">
                        ·
                      </span>
                      <span className="hidden sm:inline tabular-nums">
                        {r.predictions_count}/104 cargados
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold tabular-nums leading-none">
                      {r.total_points}
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                      puntos
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Rank({ rank }: { rank: number }) {
  const medal = rank <= 3 ? MEDAL_RING[rank - 1] : null;
  if (medal) {
    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ring-2 ${medal}`}
      >
        {rank}
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-semibold text-muted-foreground">
      {rank}
    </div>
  );
}

function Avatar({
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
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
      {initials || "—"}
    </div>
  );
}
