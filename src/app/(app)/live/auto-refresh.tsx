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
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(0);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let tickTimer: ReturnType<typeof setInterval> | null = null;
    let lastRefresh = Date.now();

    const fire = () => {
      setSpinning(true);
      // Kick the sync first so the new data is in the DB before we re-render.
      // It's rate-limited server-side, so most ticks short-circuit cheap.
      triggerLiveSync()
        .catch(() => {})
        .finally(() => {
          router.refresh();
          lastRefresh = Date.now();
          setSeconds(0);
          setTimeout(() => setSpinning(false), 600);
        });
    };

    const start = () => {
      if (!refreshTimer) refreshTimer = setInterval(fire, intervalMs);
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
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      <RefreshCw className={`h-3 w-3 ${spinning ? "animate-spin text-primary" : ""}`} />
      <span>actualizado hace {seconds}s</span>
    </div>
  );
}
