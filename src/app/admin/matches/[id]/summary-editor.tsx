"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Copy, Save } from "lucide-react";

import { saveMatchSummaryIntro } from "@/lib/admin/actions";

const AUTOSAVE_DEBOUNCE_MS = 1500;

type Props = {
  matchId: number;
  initialIntro: string;
  autoBody: string;
  kickoffPassed: boolean;
};

export function SummaryEditor({
  matchId,
  initialIntro,
  autoBody,
  kickoffPassed,
}: Props) {
  const [intro, setIntro] = useState(initialIntro);
  const [savedTick, setSavedTick] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialIntro);

  // Debounced autosave when intro changes.
  useEffect(() => {
    if (intro === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const result = await saveMatchSummaryIntro(matchId, intro);
        if (result.ok) {
          lastSaved.current = intro;
          setSavedTick(true);
          setSavingError(null);
          setTimeout(() => setSavedTick(false), 1500);
        } else {
          setSavingError(result.error);
        }
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [intro, matchId]);

  const finalText = useMemo(() => {
    const introTrimmed = intro.trim();
    if (introTrimmed.length === 0) return autoBody;
    return `${introTrimmed}\n\n${autoBody}`;
  }, [intro, autoBody]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(finalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      setCopied(false);
      console.error("clipboard error", err);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="intro"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Intro del admin
          </label>
          <SaveBadge isPending={isPending} savedTick={savedTick} error={savingError} />
        </div>
        <textarea
          id="intro"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={14}
          placeholder={`Escribí acá tu intro previo al partido. Por ejemplo:

Uhh cuántas predicciones se van a perder en este partido. Muchos seguro pusieron al Bayern en la final. Se viene el pechego contra los alemanes…`}
          className="w-full rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        {!kickoffPassed ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            ⚠ El kickoff todavía no pasó. Si mandás este texto al grupo ahora,
            revelás los pronósticos antes de tiempo y los pibes podrían cambiar los
            suyos. Esperá al kickoff.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Mensaje listo para WhatsApp
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition active:scale-[0.97] hover:bg-primary/90"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </>
            )}
          </button>
        </div>
        <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-2xl border border-border bg-muted/40 p-4 font-sans text-sm leading-relaxed">
{finalText}
        </pre>
        <p className="text-[11px] text-muted-foreground">
          Los <code>*asteriscos*</code> los renderiza WhatsApp como{" "}
          <strong>negrita</strong>. Pegá el texto tal cual.
        </p>
      </div>
    </div>
  );
}

function SaveBadge({
  isPending,
  savedTick,
  error,
}: {
  isPending: boolean;
  savedTick: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive" title={error}>
        error
      </span>
    );
  }
  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        guardando
      </span>
    );
  }
  if (savedTick) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Save className="h-3 w-3" />
        guardado
      </span>
    );
  }
  return null;
}
