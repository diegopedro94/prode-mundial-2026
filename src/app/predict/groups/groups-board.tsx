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

  const handleSaved = (matchId: number, filled: boolean) => {
    setFilledByMatch((prev) =>
      prev[matchId] === filled ? prev : { ...prev, [matchId]: filled },
    );
  };

  const lockBanner = isLocked ? (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      Fase de grupos cerrada. Tu prode queda visible pero ya no se puede editar.
    </div>
  ) : lockAt ? (
    <p className="text-xs text-zinc-500">
      Lock al kickoff del primer partido — {new Date(lockAt).toLocaleString("es-AR")}
    </p>
  ) : null;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Fase de grupos</h1>
        {lockBanner}
      </header>

      <Tabs defaultValue={groups[0]?.letter ?? "A"} className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1">
          {counts.map((c) => (
            <TabsTrigger key={c.letter} value={c.letter} className="text-xs sm:text-sm">
              <span>Grupo {c.letter}</span>
              <span className="ml-2 text-[10px] text-zinc-500">
                {c.filled}/{c.total}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {groups.map((g) => (
          <TabsContent key={g.letter} value={g.letter} className="space-y-3">
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
