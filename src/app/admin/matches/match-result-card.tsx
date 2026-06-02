"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";

import { setMatchResult } from "@/lib/admin/actions";

type Team = { id: number; name: string; fifa_code: string };

export type MatchRow = {
  id: number;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
  groupLetter: string | null;
  scheduledAt: string;
  status: "scheduled" | "live" | "finished";
  homeScore: number | null;
  awayScore: number | null;
  wentToPenalties: boolean;
  pkWinnerTeamId: number | null;
  winnerTeamId: number | null;
  homeTeam: Team & { flag_url?: string | null };
  awayTeam: Team & { flag_url?: string | null };
};

const STAGE_LABEL: Record<MatchRow["stage"], string> = {
  group: "Grupos",
  r32: "R32",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semis",
  third_place: "3er puesto",
  final: "Final",
};

const STATUS_OPTIONS: Array<{ value: MatchRow["status"]; label: string }> = [
  { value: "scheduled", label: "Programado" },
  { value: "live", label: "En curso" },
  { value: "finished", label: "Finalizado" },
];

function toInput(n: number | null): string {
  return n == null ? "" : String(n);
}

function toScore(s: string): number | null {
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function MatchResultCard({ match }: { match: MatchRow }) {
  const [home, setHome] = useState(toInput(match.homeScore));
  const [away, setAway] = useState(toInput(match.awayScore));
  const [status, setStatus] = useState<MatchRow["status"]>(match.status);
  const [pens, setPens] = useState(match.wentToPenalties);
  const [pkWinner, setPkWinner] = useState<number | null>(match.pkWinnerTeamId);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isKnockout = match.stage !== "group";

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setMatchResult({
        matchId: match.id,
        homeScore: toScore(home),
        awayScore: toScore(away),
        wentToPenalties: pens,
        pkWinnerTeamId: pkWinner,
        status,
        stage: match.stage,
      });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  };

  const kickoff = new Date(match.scheduledAt).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5 text-[11px] font-medium">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="tabular-nums">{kickoff}</span>
          <span aria-hidden="true">·</span>
          <span>
            {STAGE_LABEL[match.stage]}
            {match.groupLetter ? ` ${match.groupLetter}` : ""}
          </span>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        <TeamSide team={match.homeTeam} side="home" />

        <div className="flex items-center gap-1">
          <ScoreInput
            value={home}
            onChange={setHome}
            disabled={isPending}
            label={`Goles de ${match.homeTeam.name}`}
          />
          <span className="text-muted-foreground" aria-hidden="true">
            –
          </span>
          <ScoreInput
            value={away}
            onChange={setAway}
            disabled={isPending}
            label={`Goles de ${match.awayTeam.name}`}
          />
        </div>

        <TeamSide team={match.awayTeam} side="away" />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-3 py-2 text-xs sm:px-4">
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Estado
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MatchRow["status"])}
            disabled={isPending}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {isKnockout ? (
          <>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={pens}
                onChange={(e) => {
                  setPens(e.target.checked);
                  if (!e.target.checked) setPkWinner(null);
                }}
                disabled={isPending}
                className="accent-primary"
              />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Fue a penales
              </span>
            </label>
            {pens ? (
              <label className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ganador penales
                </span>
                <select
                  value={pkWinner ?? ""}
                  onChange={(e) =>
                    setPkWinner(e.target.value === "" ? null : Number(e.target.value))
                  }
                  disabled={isPending}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="">—</option>
                  <option value={match.homeTeam.id}>{match.homeTeam.fifa_code}</option>
                  <option value={match.awayTeam.id}>{match.awayTeam.fifa_code}</option>
                </select>
              </label>
            ) : null}
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              guardado
            </span>
          ) : null}
          {error ? (
            <span
              className="text-destructive"
              title={error}
            >
              error
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamSide({
  team,
  side,
}: {
  team: Team & { flag_url?: string | null };
  side: "home" | "away";
}) {
  const isHome = side === "home";
  return (
    <div
      className={`flex items-center gap-2 ${isHome ? "flex-row-reverse text-right" : ""}`}
    >
      <Flag flagUrl={team.flag_url ?? null} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-tight">
          {team.name}
        </div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {team.fifa_code}
        </div>
      </div>
    </div>
  );
}

function Flag({ flagUrl }: { flagUrl: string | null }) {
  if (!flagUrl) {
    return (
      <div className="h-7 w-10 shrink-0 rounded-sm bg-muted" aria-hidden="true" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl}
      alt=""
      className="h-7 w-10 shrink-0 rounded-sm object-cover shadow-sm ring-1 ring-foreground/10"
      width={40}
      height={28}
      loading="lazy"
    />
  );
}

function ScoreInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      aria-label={label}
      placeholder="–"
      className="h-10 w-12 rounded-lg border border-border bg-background text-center text-lg font-semibold tabular-nums shadow-inner outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 sm:w-14"
    />
  );
}

function StatusPill({ status }: { status: MatchRow["status"] }) {
  const styles: Record<MatchRow["status"], string> = {
    scheduled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    live:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    finished:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
  const labels: Record<MatchRow["status"], string> = {
    scheduled: "programado",
    live: "en curso",
    finished: "finalizado",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
