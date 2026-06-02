"use client";

import { useMemo, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Fase de grupos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              72 partidos. Score exacto vale 4, ganador acertado vale 2.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
            <span className="font-semibold tabular-nums">{totalFilled}</span>
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

      <Tabs defaultValue={groups[0]?.letter ?? "A"} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 gap-1 sm:grid-cols-12">
          {counts.map((c) => {
            const complete = c.total > 0 && c.filled === c.total;
            return (
              <TabsTrigger
                key={c.letter}
                value={c.letter}
                className="relative flex flex-col items-center gap-0.5 py-2 text-xs"
              >
                <span className="font-semibold">{c.letter}</span>
                <span
                  className={`tabular-nums ${complete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                >
                  {c.filled}/{c.total}
                </span>
                {complete ? (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {groups.map((g) => (
          <TabsContent key={g.letter} value={g.letter} className="space-y-2">
            {g.matches.map((m) => (
              <MatchCard
                key={m.id}
                {...m}
                isLocked={isLocked}
                onSaved={(filled) => handleSaved(m.id, filled)}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
