"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { upsertPrediction } from "@/lib/predictions/actions";
import { teamName } from "@/lib/teams/i18n";

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

  const { dateLabel, timeLabel, when } = useMemo(
    () => formatKickoff(scheduledAt),
    [scheduledAt],
  );

  const matchStarted = when === "live" || when === "past";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5 text-[11px] font-medium">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="capitalize">{dateLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{timeLabel}</span>
        </div>
        <StatusBadge status={displayStatus} matchStarted={matchStarted} error={error} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        <TeamSide team={homeTeam} side="home" />

        <div className="flex items-center gap-1">
          <ScoreInput
            value={home}
            onChange={setHome}
            disabled={isLocked}
            label={`Goles de ${teamName(homeTeam.fifa_code, homeTeam.name)}`}
          />
          <span className="text-muted-foreground" aria-hidden="true">
            –
          </span>
          <ScoreInput
            value={away}
            onChange={setAway}
            disabled={isLocked}
            label={`Goles de ${teamName(awayTeam.fifa_code, awayTeam.name)}`}
          />
        </div>

        <TeamSide team={awayTeam} side="away" />
      </div>
    </div>
  );
}

function TeamSide({ team, side }: { team: Team; side: "home" | "away" }) {
  const isHome = side === "home";
  return (
    <div
      className={`flex items-center gap-2 ${isHome ? "flex-row-reverse text-right" : ""}`}
    >
      <Flag flagUrl={team.flag_url} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-tight">
          {teamName(team.fifa_code, team.name)}
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
      inputMode="numeric"
      min={0}
      max={20}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      aria-label={label}
      placeholder="–"
      className="h-11 w-12 rounded-lg border border-border bg-background text-center text-lg font-semibold tabular-nums shadow-inner outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 sm:w-14"
    />
  );
}

function StatusBadge({
  status,
  matchStarted,
  error,
}: {
  status: SaveStatus;
  matchStarted: boolean;
  error: string | null;
}) {
  if (matchStarted) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        cerrado
      </span>
    );
  }
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        guardando
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        guardado
      </span>
    );
  if (status === "error")
    return (
      <span
        className="inline-flex items-center gap-1 text-destructive"
        title={error ?? undefined}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        error
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground/70">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
      vac&iacute;o
    </span>
  );
}

function formatKickoff(iso: string) {
  const date = new Date(iso);
  const dateLabel = date.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const timeLabel = date.toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
  const now = Date.now();
  const start = date.getTime();
  let when: "future" | "live" | "past" = "future";
  if (start <= now && start + 2 * 60 * 60 * 1000 >= now) when = "live";
  else if (start < now) when = "past";
  return { dateLabel, timeLabel, when };
}
