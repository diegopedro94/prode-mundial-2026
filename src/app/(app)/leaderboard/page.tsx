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

const MEDAL_TINTS = [
  // 0 — gold
  "bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 text-amber-950 ring-amber-400/60",
  // 1 — silver
  "bg-gradient-to-br from-zinc-200 via-zinc-300 to-zinc-400 text-zinc-900 ring-zinc-400/60",
  // 2 — bronze
  "bg-gradient-to-br from-orange-200 via-orange-300 to-orange-500 text-orange-950 ring-orange-400/60",
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
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </section>
    );
  }

  const rows = (data ?? []) as LeaderRow[];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Ordenado por puntos. Desempate: cantidad de scores exactos. Los puntos se
          recalculan automáticamente cuando un partido pasa a finalizado.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no hay jugadores. Cuando alguien cargue al menos una predicción
            aparece acá.
          </p>
        </div>
      ) : null}

      {podium.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {podium.map((r, i) => (
            <PodiumCard
              key={r.user_id}
              row={r}
              position={i}
              isMe={r.user_id === meId}
            />
          ))}
        </div>
      ) : null}

      {rest.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Jugador</th>
                <th className="px-3 py-2 text-right">Puntos</th>
                <th className="px-3 py-2 text-right hidden sm:table-cell">Exactos</th>
                <th className="px-3 py-2 text-right hidden sm:table-cell">Acertados</th>
                <th className="px-3 py-2 text-right hidden md:table-cell">Carga</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((r, i) => {
                const rank = i + 4;
                const isMe = r.user_id === meId;
                return (
                  <tr
                    key={r.user_id}
                    className={`border-t border-border ${
                      isMe ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {rank}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={r.display_name} avatarUrl={r.avatar_url} />
                        <div>
                          <div className="font-medium">{r.display_name}</div>
                          {isMe ? (
                            <div className="text-[10px] uppercase tracking-wider text-primary">
                              vos
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                      {r.total_points}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground hidden sm:table-cell">
                      {r.exact_count}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground hidden sm:table-cell">
                      {r.scored_count}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {r.predictions_count}/104
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function PodiumCard({
  row,
  position,
  isMe,
}: {
  row: LeaderRow;
  position: number;
  isMe: boolean;
}) {
  const tint = MEDAL_TINTS[position] ?? MEDAL_TINTS[0]!;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card p-4 ${isMe ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ring-2 ${tint}`}
        >
          {position + 1}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{row.total_points}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            puntos
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Avatar name={row.display_name} avatarUrl={row.avatar_url} size="md" />
        <div className="min-w-0">
          <div className="truncate font-semibold">{row.display_name}</div>
          {isMe ? (
            <div className="text-[10px] uppercase tracking-wider text-primary">
              vos
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-mono font-semibold text-foreground">
            {row.exact_count}
          </span>{" "}
          exactos
        </span>
        <span>
          <span className="font-mono font-semibold text-foreground">
            {row.scored_count}
          </span>{" "}
          acertados
        </span>
        <span className="text-[10px] tabular-nums">{row.predictions_count}/104</span>
      </div>
    </div>
  );
}

function Avatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const cls = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`${cls} shrink-0 rounded-full object-cover ring-1 ring-border`}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground`}
    >
      {initials || "—"}
    </div>
  );
}
