"use client";

import { useState, useTransition } from "react";

import { lockAllRosters } from "@/lib/admin/actions";

export function LockRostersButton({ disabled }: { disabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (disabled) return;
    if (
      !confirm(
        "¿Lockear TODOS los rosters? Los selectores de especiales quedan congelados al pool actual. Acción registrada en el audit log.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await lockAllRosters();
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending
          ? "Lockeando..."
          : disabled
            ? "Ya lockeado"
            : "Lockear todos los rosters"}
      </button>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400" title={error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
