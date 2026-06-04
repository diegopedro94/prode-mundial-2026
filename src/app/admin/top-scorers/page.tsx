import { Target } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teamName } from "@/lib/teams/i18n";

type Row = {
  player_id: number;
  player_name: string;
  player_position: "GK" | "DEF" | "MID" | "FWD" | null;
  team_id: number;
  team_name: string;
  team_fifa_code: string;
  team_flag_url: string | null;
  goals_count: number;
  is_in_official_roster: boolean;
};

export default async function AdminTopScorersPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_top_scorers", { limit_count: 50 });

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Goleadores</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </section>
    );
  }

  const rows = (data ?? []) as Row[];

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Goleadores
        </h1>
        <p className="text-sm text-muted-foreground">
          Cuenta acumulada de goles convertidos. Se actualiza automáticamente con el
          sync de api-football (los autogoles no cuentan). El jugador que termine
          arriba define la prediccion de Goleador del torneo (3 pts).
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
          <Target className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Sin goles registrados todavía. La tabla se popula cuando termina el
            primer partido.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Jugador</th>
                <th className="px-3 py-2">Selecci&oacute;n</th>
                <th className="px-3 py-2 text-right">Goles</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.player_id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {r.player_position ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {r.player_position}
                        </span>
                      ) : null}
                      <span className="font-medium">{r.player_name}</span>
                      {!r.is_in_official_roster ? (
                        <span
                          className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400"
                          title="No estaba en la lista oficial cuando se lockearon los rosters"
                        >
                          extra
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {r.team_flag_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.team_flag_url}
                          alt=""
                          className="h-4 w-6 rounded-sm object-cover ring-1 ring-foreground/10"
                          loading="lazy"
                        />
                      ) : null}
                      <span>{teamName(r.team_fifa_code, r.team_name)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                    {r.goals_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
