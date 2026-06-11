"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { triggerLiveSync } from "@/lib/sync/live-sync-action";

// Drives a soft refresh of the Server Component every `intervalMs`. We rely on
// router.refresh() (not revalidatePath) so the user keeps their scroll position
// and the goal list updates in place. A small ticker keeps the "actualizado
// hace Ns" line counting in real time, so the user can tell the page is alive
// even between cron updates.
type SyncStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; ran: boolean; reason?: string }
  | { kind: "error"; message: string };

export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle" });

  useEffect(() => {
    if (typeof document === "undefined") return;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let tickTimer: ReturnType<typeof setInterval> | null = null;
    let lastRefresh = Date.now();

    const fire = async () => {
      setSpinning(true);
      setStatus({ kind: "running" });
      try {
        const result = await triggerLiveSync();
        if (result.ok) {
          setStatus({ kind: "ok", ran: result.ran, reason: result.reason });
        } else {
          setStatus({ kind: "error", message: result.error });
        }
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        router.refresh();
        lastRefresh = Date.now();
        setSeconds(0);
        setTimeout(() => setSpinning(false), 600);
      }
    };

    const start = () => {
      if (!refreshTimer) {
        // Fire immediately on mount so the user doesn't have to wait the
        // full intervalMs to see the first refresh.
        fire();
        refreshTimer = setInterval(fire, intervalMs);
      }
      if (!tickTimer) {
        tickTimer = setInterval(() => {
          setSeconds(Math.max(0, Math.floor((Date.now() - lastRefresh) / 1000)));
        }, 1000);
      }
    };
    const stop = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return (
    <div className="flex flex-col items-end gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <RefreshCw className={`h-3 w-3 ${spinning ? "animate-spin text-primary" : ""}`} />
        <span>actualizado hace {seconds}s</span>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function StatusBadge({ status }: { status: SyncStatus }) {
  if (status.kind === "idle") return null;
  if (status.kind === "running") {
    return <span className="text-amber-600 dark:text-amber-400">sincronizando...</span>;
  }
  if (status.kind === "error") {
    return (
      <span title={status.message} className="text-destructive">
        error: {status.message.slice(0, 30)}
      </span>
    );
  }
  if (!status.ran) {
    return <span>rate-limited (60s)</span>;
  }
  return <span className="text-emerald-600 dark:text-emerald-400">sync ok</span>;
}
