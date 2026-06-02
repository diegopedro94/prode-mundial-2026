"use client";

import { useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { setRoundLock } from "@/lib/admin/actions";

type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";

const STAGE_LABEL: Record<Stage, string> = {
  group: "Fase de grupos",
  r32: "Ronda de 32",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinales",
  third_place: "Tercer puesto",
  final: "Final",
};

const TZ = "America/Argentina/Buenos_Aires";

// `datetime-local` inputs require "YYYY-MM-DDTHH:mm" in *local* time without an
// offset. We render the stored UTC instant in the user's timezone and parse
// back through the same TZ.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function fromLocalInput(value: string): string {
  // The input is "YYYY-MM-DDTHH:mm" in Argentina time (UTC-3). We append the
  // offset and pass through Date which then yields the right UTC instant.
  return new Date(`${value}:00-03:00`).toISOString();
}

export function RoundsTable({
  rounds,
}: {
  rounds: { stage: Stage; locks_at: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground ">
          <tr>
            <th className="px-3 py-2">Ronda</th>
            <th className="px-3 py-2">Locks at (ARG)</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <RoundRow key={r.stage} stage={r.stage} initialLocksAt={r.locks_at} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoundRow({
  stage,
  initialLocksAt,
}: {
  stage: Stage;
  initialLocksAt: string;
}) {
  const [value, setValue] = useState(toLocalInput(initialLocksAt));
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    setSavedTick(false);
    startTransition(async () => {
      const result = await setRoundLock({
        stage,
        locksAt: fromLocalInput(value),
      });
      if (result.ok) {
        setSavedTick(true);
        setTimeout(() => setSavedTick(false), 2000);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium">{STAGE_LABEL[stage]}</td>
      <td className="px-3 py-2">
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          className="w-56"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
        {savedTick ? (
          <span className="ml-2 text-sm text-emerald-600 dark:text-emerald-400">
            &#10003;
          </span>
        ) : null}
        {error ? (
          <span className="ml-2 text-sm text-destructive" title={error}>
            Error
          </span>
        ) : null}
      </td>
    </tr>
  );
}
