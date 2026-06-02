"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Check } from "lucide-react";

import { MatchCard, type MatchCardProps } from "./match-card";

type GroupMatchSeed = Omit<MatchCardProps, "isLocked" | "onSaved">;

type GroupSeed = {
  letter: string;
  matches: GroupMatchSeed[];
};

type Props = {
  groups: GroupSeed[];
  isLocked: boolean;
  lockAt: string | null;
};

export function GroupsBoard({ groups, isLocked, lockAt }: Props) {
  const [filledByMatch, setFilledByMatch] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const g of groups) {
      for (const m of g.matches) {
        initial[m.id] = m.prediction != null;
      }
    }
    return initial;
  });

  const [activeLetter, setActiveLetter] = useState<string>(
    groups[0]?.letter ?? "A",
  );

  const counts = useMemo(() => {
    return groups.map((g) => ({
      letter: g.letter,
      filled: g.matches.filter((m) => filledByMatch[m.id]).length,
      total: g.matches.length,
    }));
  }, [groups, filledByMatch]);

  const totalFilled = counts.reduce((acc, c) => acc + c.filled, 0);
  const totalMatches = counts.reduce((acc, c) => acc + c.total, 0);

  const handleSaved = (matchId: number, filled: boolean) => {
    setFilledByMatch((prev) =>
      prev[matchId] === filled ? prev : { ...prev, [matchId]: filled },
    );
  };

  const activeGroup = groups.find((g) => g.letter === activeLetter) ?? groups[0];

  // Auto-scroll the active pill into view when it changes.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLButtonElement>(
      `[data-group="${activeLetter}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeLetter]);

  return (
    <section className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Fase de grupos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              72 partidos. Score exacto vale 4, ganador acertado vale 2.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card px-3 py-1.5 text-sm shadow-sm">
            <span className="font-mono font-semibold tabular-nums">{totalFilled}</span>
            <span className="text-muted-foreground"> / {totalMatches} cargados</span>
          </div>
        </div>

        {isLocked ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            Fase de grupos cerrada. Tu prode queda visible pero ya no se puede editar.
          </div>
        ) : lockAt ? (
          <p className="text-xs text-muted-foreground">
            Lock al kickoff del 1er partido —{" "}
            <span className="font-medium text-foreground">
              {new Date(lockAt).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                day: "2-digit",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>
        ) : null}
      </header>

      {/* Group pills — horizontal scroll on all sizes. Snap so the active tab
          centers crisply on swipe. */}
      <div
        ref={stripRef}
        className="-mx-4 flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {counts.map((c) => {
          const isActive = c.letter === activeLetter;
          const complete = c.total > 0 && c.filled === c.total;
          return (
            <button
              key={c.letter}
              type="button"
              data-group={c.letter}
              onClick={() => setActiveLetter(c.letter)}
              className={`relative flex shrink-0 snap-start flex-col items-center justify-center rounded-2xl border px-4 py-2.5 text-xs font-medium transition active:scale-[0.96] ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "border-border bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted"
              }`}
              aria-pressed={isActive}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-70">
                Grupo
              </span>
              <span className="font-display text-lg font-bold leading-none">
                {c.letter}
              </span>
              <span
                className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                  isActive
                    ? "text-primary-foreground/80"
                    : complete
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                {c.filled}/{c.total}
              </span>
              {complete && !isActive ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-emerald-950">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {activeGroup?.matches.map((m) => (
          <MatchCard
            key={m.id}
            {...m}
            isLocked={isLocked}
            onSaved={(filled) => handleSaved(m.id, filled)}
          />
        ))}
      </div>
    </section>
  );
}
