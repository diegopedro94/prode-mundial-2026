"use client";

import dynamic from "next/dynamic";

const InstallPwaBanner = dynamic(
  () => import("./install-pwa-banner").then((m) => m.InstallPwaBanner),
  { ssr: false },
);

export function InstallPwaMount() {
  return <InstallPwaBanner />;
}
