"use client";

import { useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
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
  homeTeam: Team;
  awayTeam: Team;
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {kickoff} &middot; {STAGE_LABEL[match.stage]}
          {match.groupLetter ? ` ${match.groupLetter}` : ""}
        </span>
        <StatusPill status={status} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right text-sm font-medium">{match.homeTeam.name}</div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={20}
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="h-9 w-12 text-center"
            disabled={isPending}
            aria-label={`Goles de ${match.homeTeam.name}`}
          />
          <span className="text-zinc-400">—</span>
          <Input
            type="number"
            min={0}
            max={20}
            value={away}
            onChange={(e) => setAway(e.target.value)}
            className="h-9 w-12 text-center"
            disabled={isPending}
            aria-label={`Goles de ${match.awayTeam.name}`}
          />
        </div>
        <div className="text-sm font-medium">{match.awayTeam.name}</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Estado</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MatchRow["status"])}
            disabled={isPending}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
              />
              <span className="text-xs uppercase tracking-wider text-zinc-500">
                Fue a penales
              </span>
            </label>
            {pens ? (
              <label className="flex items-center gap-1.5">
                <span className="text-xs uppercase tracking-wider text-zinc-500">
                  Gan&oacute; penales
                </span>
                <select
                  value={pkWinner ?? ""}
                  onChange={(e) =>
                    setPkWinner(e.target.value === "" ? null : Number(e.target.value))
                  }
                  disabled={isPending}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">—</option>
                  <option value={match.homeTeam.id}>{match.homeTeam.fifa_code}</option>
                  <option value={match.awayTeam.id}>{match.awayTeam.fifa_code}</option>
                </select>
              </label>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="ml-auto rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>

        {saved ? (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Guardado &#10003;
          </span>
        ) : null}
        {error ? (
          <span className="text-sm text-red-600 dark:text-red-400" title={error}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: MatchRow["status"] }) {
  const styles: Record<MatchRow["status"], string> = {
    scheduled:
      "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    live: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    finished:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
  const labels: Record<MatchRow["status"], string> = {
    scheduled: "Programado",
    live: "En curso",
    finished: "Finalizado",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
