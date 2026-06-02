"use client";

import { useEffect, useState } from "react";

type Props = {
  /** ISO timestamp of the target moment. */
  target: string;
  /** Label rendered above the digits. */
  label?: string;
  /** Optional className for the container. */
  className?: string;
};

function diffParts(targetMs: number, nowMs: number) {
  const total = Math.max(0, targetMs - nowMs);
  const seconds = Math.floor(total / 1000) % 60;
  const minutes = Math.floor(total / (1000 * 60)) % 60;
  const hours = Math.floor(total / (1000 * 60 * 60)) % 24;
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, seconds, total };
}

export function Countdown({ target, label, className }: Props) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const { days, hours, minutes, seconds, total } = diffParts(targetMs, now);

  if (total === 0) {
    return (
      <div className={className}>
        {label ? <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p> : null}
        <p className="mt-2 text-2xl font-semibold">¡Empezó!</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {label ? (
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      ) : null}
      <div className="mt-2 grid grid-cols-4 gap-2 text-center font-mono">
        <TimeCell value={days} unit="días" />
        <TimeCell value={hours} unit="hs" />
        <TimeCell value={minutes} unit="min" />
        <TimeCell value={seconds} unit="seg" />
      </div>
    </div>
  );
}

function TimeCell({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-2 py-2 backdrop-blur-sm">
      <div className="text-2xl font-semibold tabular-nums leading-tight sm:text-3xl">
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {unit}
      </div>
    </div>
  );
}
