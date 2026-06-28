"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { KnockoutMatchCard, type KnockoutMatchSeed } from "./match-card";

type Props = {
  stageLabel: string;
  matches: KnockoutMatchSeed[];
  isLocked: boolean;
  lockAt: string | null;
};

const STAGES = [
  { slug: "r32", short: "16vos" },
  { slug: "r16", short: "8vos" },
  { slug: "qf", short: "Cuartos" },
  { slug: "sf", short: "Semis" },
  { slug: "third", short: "3°" },
  { slug: "final", short: "Final" },
] as const;

export function KnockoutBoard({ stageLabel, matches, isLocked, lockAt }: Props) {
  const pathname = usePathname() ?? "";
  const [filledByMatch, setFilledByMatch] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const m of matches) initial[m.id] = m.prediction != null;
    return initial;
  });

  const total = matches.length;
  const filled = useMemo(
    () => matches.filter((m) => filledByMatch[m.id]).length,
    [matches, filledByMatch],
  );

  const playableCount = matches.filter(
    (m) => m.homeTeam != null && m.awayTeam != null,
  ).length;
  const pendingBracket = total > 0 && playableCount === 0;

  const handleSaved = (matchId: number, isFilled: boolean) => {
    setFilledByMatch((prev) =>
      prev[matchId] === isFilled ? prev : { ...prev, [matchId]: isFilled },
    );
  };

  return (
    <section className="space-y-5">
      {/* Stage strip — lets the user hop between all six knockout rounds
          without going back to the top nav. */}
      <div className="-mx-4 flex snap-x snap-mandatory items-stretch gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STAGES.map((s) => {
          const href = `/predict/${s.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={s.slug}
              href={href}
              className={`shrink-0 snap-start rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-[0.96] ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-border bg-card text-foreground/70 hover:border-primary/40 hover:bg-muted"
              }`}
            >
              {s.short}
            </Link>
          );
        })}
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {stageLabel}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Score exacto 4, ganador 2. Siempre elegí quién ganaría por
              penales — si el partido va al shootout y adivinás al ganador,
              +1.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card px-3 py-1.5 text-sm shadow-sm">
            <span className="font-mono font-semibold tabular-nums">{filled}</span>
            <span className="text-muted-foreground"> / {total} cargados</span>
          </div>
        </div>

        {isLocked ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            Esta ronda ya está cerrada. Tu prode queda visible pero ya no se puede
            editar.
          </div>
        ) : lockAt ? (
          <p className="text-xs text-muted-foreground">
            Cierre de la ronda —{" "}
            <span className="font-medium text-foreground">
              {new Date(lockAt).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                day: "2-digit",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            . Cada partido se cierra a su propio kickoff si llega antes.
          </p>
        ) : null}

        {pendingBracket ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            El cuadro de esta ronda todavía no está armado. Aparece automáticamente
            cuando avanzan los equipos clasificados.
          </div>
        ) : null}
      </header>

      <div className="space-y-2">
        {matches.map((m) => (
          <KnockoutMatchCard
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
