import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MatchResultCard, type MatchRow } from "./match-result-card";

type DbMatch = {
  id: number;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
  group_letter: string | null;
  scheduled_at: string;
  status: "scheduled" | "live" | "finished";
  home_score: number | null;
  away_score: number | null;
  went_to_penalties: boolean;
  pk_winner_team_id: number | null;
  winner_team_id: number | null;
  home_team: { id: number; name: string; fifa_code: string; flag_url: string | null } | null;
  away_team: { id: number; name: string; fifa_code: string; flag_url: string | null } | null;
};

const ARG_TZ = "America/Argentina/Buenos_Aires";

function localDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: ARG_TZ,
    day: "2-digit",
    month: "long",
    weekday: "long",
  });
}

export default async function AdminMatchesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("matches")
    .select(
      `id, stage, group_letter, scheduled_at, status, home_score, away_score,
       went_to_penalties, pk_winner_team_id, winner_team_id,
       home_team:home_team_id(id, name, fifa_code, flag_url),
       away_team:away_team_id(id, name, fifa_code, flag_url)`,
    )
    .order("scheduled_at");

  const matches = (data ?? []) as unknown as DbMatch[];

  const byDate = new Map<string, DbMatch[]>();
  for (const m of matches) {
    const key = localDateKey(m.scheduled_at);
    const arr = byDate.get(key) ?? [];
    arr.push(m);
    byDate.set(key, arr);
  }

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Partidos
        </h1>
        <p className="text-sm text-muted-foreground">
          Carga manual de resultados. El sync con api-football corre en paralelo;
          la última escritura gana. Cada cambio queda en el audit log.
        </p>
      </header>

      {byDate.size === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          No hay partidos cargados todavía.
        </div>
      ) : null}

      {[...byDate.entries()].map(([date, matches]) => (
        <div key={date} className="space-y-3">
          <h2 className="sticky top-[88px] z-10 bg-background/80 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
            {date}
          </h2>
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchResultCard
                key={m.id}
                match={{
                  id: m.id,
                  stage: m.stage,
                  groupLetter: m.group_letter,
                  scheduledAt: m.scheduled_at,
                  status: m.status,
                  homeScore: m.home_score,
                  awayScore: m.away_score,
                  wentToPenalties: m.went_to_penalties,
                  pkWinnerTeamId: m.pk_winner_team_id,
                  winnerTeamId: m.winner_team_id,
                  homeTeam: m.home_team!,
                  awayTeam: m.away_team!,
                } satisfies MatchRow}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
