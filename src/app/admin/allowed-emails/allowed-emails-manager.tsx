"use client";

import { useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { removeAllowedEmail, upsertAllowedEmail } from "@/lib/admin/actions";

export type AllowedEmailRow = {
  email: string;
  isAdmin: boolean;
  addedAt: string;
  addedBy: string;
};

const TZ = "America/Argentina/Buenos_Aires";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AllowedEmailsManager({
  rows,
  currentUserEmail,
}: {
  rows: AllowedEmailRow[];
  currentUserEmail: string | null;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    setAddError(null);
    startTransition(async () => {
      const result = await upsertAllowedEmail({
        email: newEmail,
        isAdmin: newIsAdmin,
      });
      if (result.ok) {
        setNewEmail("");
        setNewIsAdmin(false);
      } else {
        setAddError(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium">Invitar un email</div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Input
              type="email"
              placeholder="amigo@gmail.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={isPending}
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              disabled={isPending}
            />
            <span>Admin</span>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || newEmail === ""}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Agregando..." : "Agregar"}
          </button>
        </div>
        {addError ? (
          <p className="mt-2 text-sm text-destructive">{addError}</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground ">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Agregado</th>
              <th className="px-3 py-2">Por</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.email} row={r} currentUserEmail={currentUserEmail} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  currentUserEmail,
}: {
  row: AllowedEmailRow;
  currentUserEmail: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isSelf =
    currentUserEmail !== null && row.email.toLowerCase() === currentUserEmail.toLowerCase();

  const handleRemove = () => {
    if (!confirm(`¿Sacar ${row.email} de la whitelist?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeAllowedEmail(row.email);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-xs">{row.email}</td>
      <td className="px-3 py-2">
        {row.isAdmin ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            admin
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">player</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(row.addedAt)}</td>
      <td className="px-3 py-2 text-xs">{row.addedBy}</td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending || isSelf}
          title={isSelf ? "No te podés sacar a vos mismo" : undefined}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "..." : "Sacar"}
        </button>
        {error ? (
          <p className="text-right text-xs text-destructive">{error}</p>
        ) : null}
      </td>
    </tr>
  );
}
