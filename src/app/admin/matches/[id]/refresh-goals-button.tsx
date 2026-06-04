"use client";

import { useState, useTransition } from "react";
import { Check, RefreshCw } from "lucide-react";

import { refreshMatchGoals } from "@/lib/admin/actions";

export function RefreshGoalsButton({ matchId }: { matchId: number }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (
      !confirm(
        "Re-fetch los goles desde api-football y reemplazar lo que tenemos. Útil si FIFA corrige un goleador post-partido. ¿Seguir?",
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await refreshMatchGoals(matchId);
      if (result.ok) {
        setFeedback(`${result.inserted ?? 0} goles re-sincronizados`);
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition active:scale-[0.97] hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {isPending ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Refrescando…
          </>
        ) : feedback ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            Listo
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar goleadores
          </>
        )}
      </button>
      {feedback ? (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          {feedback}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs text-destructive" title={error}>
          Error
        </span>
      ) : null}
    </div>
  );
}
