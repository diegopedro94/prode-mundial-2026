"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";

import { setUserDisplayName } from "@/lib/admin/actions";

type Props = {
  userId: string;
  current: string;
};

export function DisplayNameEditor({ userId, current }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setValue(current);
    setError(null);
    setEditing(false);
  };

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("No puede estar vacío");
      return;
    }
    if (trimmed === current) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await setUserDisplayName({ userId, displayName: trimmed });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editar nombre"
        title="Editar nombre"
        className="inline-flex items-center gap-1 rounded-md p-1 text-xs text-muted-foreground transition active:scale-[0.96] hover:bg-muted hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          disabled={isPending}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") reset();
          }}
          className="h-8 w-48 rounded-md border border-border bg-background px-2 text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          aria-label="Guardar"
          className="rounded-md bg-primary p-1.5 text-primary-foreground transition active:scale-[0.96] hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={isPending}
          aria-label="Cancelar"
          className="rounded-md border border-border p-1.5 text-muted-foreground transition active:scale-[0.96] hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
