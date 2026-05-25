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
        <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
      </section>
    );
  }

  const rows = (data ?? []) as LeaderRow[];

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ordenado por puntos. Desempate: cantidad de scores exactos. Los puntos se
          recalculan automáticamente cuando un partido pasa a finalizado.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Todavía no hay jugadores. Cuando alguien cargue al menos una predicción aparece acá.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Jugador</th>
                <th className="px-3 py-2 text-right">Puntos</th>
                <th className="px-3 py-2 text-right">Exactos</th>
                <th className="px-3 py-2 text-right">Acertados</th>
                <th className="px-3 py-2 text-right">Predicciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isMe = r.user_id === meId;
                return (
                  <tr
                    key={r.user_id}
                    className={`border-t border-zinc-200 dark:border-zinc-800 ${
                      isMe ? "bg-emerald-50/60 dark:bg-emerald-950/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {r.display_name}
                      {isMe ? (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          vos
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {r.total_points}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {r.exact_count}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {r.scored_count}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500">
                      {r.predictions_count}/104
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
