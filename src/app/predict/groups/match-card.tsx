"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { upsertPrediction } from "@/lib/predictions/actions";

type Team = { id: number; name: string; fifa_code: string; flag_url: string | null };

export type MatchCardProps = {
  id: number;
  scheduledAt: string;
  homeTeam: Team;
  awayTeam: Team;
  prediction: { home_score: number; away_score: number } | null;
  isLocked: boolean;
  onSaved?: (filled: boolean) => void;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 800;

function isValidScore(value: string): boolean {
  if (value === "") return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 20;
}

export function MatchCard({
  id,
  scheduledAt,
  homeTeam,
  awayTeam,
  prediction,
  isLocked,
  onSaved,
}: MatchCardProps) {
  const [home, setHome] = useState(prediction?.home_score?.toString() ?? "");
  const [away, setAway] = useState(prediction?.away_score?.toString() ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(
    prediction ? `${prediction.home_score}-${prediction.away_score}` : "",
  );

  useEffect(() => {
    if (isLocked) return;
    if (!isValidScore(home) || !isValidScore(away)) return;
    const key = `${home}-${away}`;
    if (key === lastSaved.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      setError(null);
      const result = await upsertPrediction({
        matchId: id,
        homeScore: Number(home),
        awayScore: Number(away),
      });
      if (result.ok) {
        lastSaved.current = key;
        setStatus("saved");
        onSaved?.(true);
      } else {
        setStatus("error");
        setError(result.error);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [home, away, id, isLocked, onSaved]);

  const inputsValid = isValidScore(home) && isValidScore(away);
  const displayStatus: SaveStatus = inputsValid ? status : "idle";

  const dateLabel = new Date(scheduledAt).toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>{dateLabel}</span>
        <StatusBadge status={displayStatus} error={error} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamLabel team={homeTeam} side="home" />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={home}
            disabled={isLocked}
            onChange={(e) => setHome(e.target.value)}
            className="h-10 w-14 text-center text-base"
            aria-label={`Goles de ${homeTeam.name}`}
          />
          <span className="text-zinc-400">—</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={away}
            disabled={isLocked}
            onChange={(e) => setAway(e.target.value)}
            className="h-10 w-14 text-center text-base"
            aria-label={`Goles de ${awayTeam.name}`}
          />
        </div>
        <TeamLabel team={awayTeam} side="away" />
      </div>
    </div>
  );
}

function TeamLabel({ team, side }: { team: Team; side: "home" | "away" }) {
  return (
    <div
      className={`flex items-center gap-2 ${side === "away" ? "flex-row-reverse text-right" : ""}`}
    >
      {team.flag_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.flag_url}
          alt=""
          className="h-5 w-7 rounded-sm object-cover"
          width={28}
          height={20}
        />
      ) : null}
      <span className="text-sm font-medium">{team.name}</span>
    </div>
  );
}

function StatusBadge({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === "saving")
    return <span className="text-amber-600 dark:text-amber-400">Guardando…</span>;
  if (status === "saved")
    return <span className="text-emerald-600 dark:text-emerald-400">Guardado &#10003;</span>;
  if (status === "error")
    return (
      <span className="text-red-600 dark:text-red-400" title={error ?? undefined}>
        Error
      </span>
    );
  return null;
}
