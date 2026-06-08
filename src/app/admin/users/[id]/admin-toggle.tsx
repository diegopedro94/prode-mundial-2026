"use client";

import { useState, useTransition } from "react";
import { Shield, ShieldOff } from "lucide-react";

import { setUserAdmin } from "@/lib/admin/actions";

type Props = {
  userId: string;
  isAdmin: boolean;
  isSelf: boolean;
  displayName: string;
};

export function AdminToggle({ userId, isAdmin, isSelf, displayName }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setError(null);
    const next = !isAdmin;
    const verb = next ? "Convertir en admin" : "Quitar admin";
    if (!confirm(`${verb} a ${displayName}?`)) return;
    startTransition(async () => {
      const r = await setUserAdmin({ userId, isAdmin: next });
      if (!r.ok) setError(r.error);
    });
  };

  if (isSelf) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <Shield className="h-3 w-3" />
        Admin (vos)
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition active:scale-[0.97] disabled:opacity-50 ${
          isAdmin
            ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
            : "bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        {isAdmin ? (
          <>
            <ShieldOff className="h-3.5 w-3.5" />
            Quitar admin
          </>
        ) : (
          <>
            <Shield className="h-3.5 w-3.5" />
            Hacer admin
          </>
        )}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
