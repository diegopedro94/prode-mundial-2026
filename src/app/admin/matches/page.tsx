import Link from "next/link";

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

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const params = await searchParams;
  const showAll = params.all === "1";

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

  // Hide finished by default so the admin lands on the work that's still
  // open (the next matches to enter results / fix). The "Mostrar todos"
  // link reveals the full history when needed.
  const finishedCount = matches.filter((m) => m.status === "finished").length;
  const visible = showAll ? matches : matches.filter((m) => m.status !== "finished");

  const byDate = new Map<string, DbMatch[]>();
  for (const m of visible) {
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

      {finishedCount > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {showAll
              ? `Mostrando todos los partidos (${finishedCount} finalizados incluidos).`
              : `${finishedCount} finalizado${finishedCount === 1 ? "" : "s"} oculto${finishedCount === 1 ? "" : "s"}.`}
          </span>
          <Link
            href={showAll ? "/admin/matches" : "/admin/matches?all=1"}
            className="rounded-md px-2 py-1 font-medium text-primary transition active:scale-[0.96] hover:bg-muted"
          >
            {showAll ? "Ocultar finalizados" : "Mostrar todos"}
          </Link>
        </div>
      ) : null}

      {byDate.size === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          {finishedCount > 0
            ? "Todos los partidos restantes ya terminaron. Tocá \"Mostrar todos\" para verlos."
            : "No hay partidos cargados todavía."}
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
