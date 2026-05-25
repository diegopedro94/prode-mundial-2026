import { createSupabaseServerClient } from "@/lib/supabase/server";

type SyncLogRow = {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  fixtures_processed: number;
  fixtures_updated: number;
  requests_remaining: number | null;
  error_message: string | null;
};

const TZ = "America/Argentina/Buenos_Aires";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function AdminSyncPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("sync_log")
    .select(
      "id, started_at, finished_at, status, fixtures_processed, fixtures_updated, requests_remaining, error_message",
    )
    .order("started_at", { ascending: false })
    .limit(50);

  const runs = (data ?? []) as SyncLogRow[];
  const lastSuccess = runs.find((r) => r.status === "success");
  const lastError = runs.find((r) => r.status === "error");
  const requestsRemaining = lastSuccess?.requests_remaining ?? null;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Estado del sync</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          GitHub Actions corre <code className="text-xs">sync-results.ts</code> cada 5
          minutos durante el Mundial. El script se auto-saltea si no hay partidos hoy.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Último sync exitoso"
          value={lastSuccess ? formatTime(lastSuccess.started_at) : "—"}
          tone={lastSuccess ? "good" : "neutral"}
        />
        <Stat
          label="Último error"
          value={lastError ? formatTime(lastError.started_at) : "Sin errores recientes"}
          tone={lastError ? "bad" : "good"}
        />
        <Stat
          label="api-football quota restante hoy"
          value={requestsRemaining != null ? `${requestsRemaining}/7500` : "—"}
          tone={
            requestsRemaining == null
              ? "neutral"
              : requestsRemaining < 500
                ? "bad"
                : "good"
          }
        />
      </div>

      {lastError?.error_message ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          <strong>Último error:</strong> {lastError.error_message}
        </div>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Últimas 50 corridas
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin corridas registradas.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Cuando</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Duraci&oacute;n</th>
                  <th className="px-3 py-2 text-right">Procesados</th>
                  <th className="px-3 py-2 text-right">Actualizados</th>
                  <th className="px-3 py-2 text-right">Quota</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatTime(r.started_at)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatDuration(r.started_at, r.finished_at)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.fixtures_processed}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.fixtures_updated}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.requests_remaining ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
}) {
  const tones = {
    good: "border-emerald-300 dark:border-emerald-700",
    bad: "border-red-300 dark:border-red-700",
    neutral: "border-zinc-200 dark:border-zinc-800",
  };
  return (
    <div
      className={`rounded-xl border bg-white p-4 dark:bg-zinc-950 ${tones[tone]}`}
    >
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-medium">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: SyncLogRow["status"] }) {
  const styles = {
    running: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  );
}
