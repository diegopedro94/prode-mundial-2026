import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teamName } from "@/lib/teams/i18n";

import { LockRostersButton } from "./lock-rosters-button";

type TeamRow = { id: number; name: string; fifa_code: string };
type PlayerRow = { team_id: number; is_in_official_roster: boolean };

export default async function AdminRostersPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: teamsData }, { data: playersData }] = await Promise.all([
    supabase.from("teams").select("id, name, fifa_code").order("name"),
    supabase.from("players").select("team_id, is_in_official_roster"),
  ]);

  const teams = (teamsData ?? []) as TeamRow[];
  const players = (playersData ?? []) as PlayerRow[];

  const stats = new Map<number, { total: number; locked: number }>();
  for (const p of players) {
    const s = stats.get(p.team_id) ?? { total: 0, locked: 0 };
    s.total += 1;
    if (p.is_in_official_roster) s.locked += 1;
    stats.set(p.team_id, s);
  }

  const totalPlayers = players.length;
  const totalLocked = players.filter((p) => p.is_in_official_roster).length;
  const allLocked = totalPlayers > 0 && totalLocked === totalPlayers;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Lock rosters</h1>
        <p className="text-sm text-muted-foreground">
          Los selectores de Goleador / MVP / Mejor arquero en
          {" "}
          <code className="text-xs">/predict/special</code> solo muestran jugadores con
          <code className="text-xs"> is_in_official_roster = true</code>. Cuando FIFA
          publique las listas finales, hacé click en{" "}
          <strong>Lockear todos los rosters</strong> y el conjunto queda
          inmutable como pool de elección para las predicciones especiales.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">
              {totalLocked} / {totalPlayers} jugadores lockeados
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {allLocked
                ? "Rosters lockeados. Para ajustes finos (lesiones, etc.) usá SQL directo en allowed_emails — no hay UI per-player todavía."
                : "Antes de lockear, asegurate de que las listas oficiales ya estén publicadas. El pull desde api-football trae todos los jugadores convocados; lockear los marca a todos como official."}
            </p>
          </div>
          <LockRostersButton disabled={allLocked} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground ">
            <tr>
              <th className="px-3 py-2">Selecci&oacute;n</th>
              <th className="px-3 py-2 text-right">Jugadores</th>
              <th className="px-3 py-2 text-right">Lockeados</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const s = stats.get(t.id) ?? { total: 0, locked: 0 };
              const isFullyLocked = s.total > 0 && s.locked === s.total;
              return (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {teamName(t.fifa_code, t.name)}{" "}
                    <span className="text-xs text-muted-foreground">({t.fifa_code})</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{s.total}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {isFullyLocked ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {s.locked}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{s.locked}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
