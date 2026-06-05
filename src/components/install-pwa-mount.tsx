"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const InstallPwaBanner = dynamic(
  () => import("./install-pwa-banner").then((m) => m.InstallPwaBanner),
  { ssr: false },
);

export function InstallPwaMount() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Defer registration to idle to avoid competing with initial paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Swallow — SW is a progressive enhancement; the app works without it.
      });
    };
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(register);
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(register, 1000);
    return () => window.clearTimeout(id);
  }, []);

  return <InstallPwaBanner />;
}
