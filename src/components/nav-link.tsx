"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  children: React.ReactNode;
  /** Treat as active when the current path starts with `href`. Useful for
   *  hub routes (e.g. `/predict` should stay active on `/predict/groups`). */
  matchSubpaths?: boolean;
  /** Visual size: "default" for the primary app nav, "sm" for secondary
   *  sub-nav bars (e.g. admin breadcrumbs). */
  size?: "default" | "sm";
  /** When true, override the default active styling with a primary tint —
   *  used for the Admin entry to stand out. */
  highlight?: boolean;
};

export function NavLink({
  href,
  children,
  matchSubpaths,
  size = "default",
  highlight,
}: Props) {
  const pathname = usePathname() ?? "";
  const isActive = matchSubpaths
    ? pathname === href || pathname.startsWith(`${href}/`)
    : pathname === href;

  const base =
    size === "sm"
      ? "rounded-md px-2.5 py-1 text-xs font-medium transition active:scale-[0.96]"
      : "rounded-md px-2.5 py-1.5 text-sm font-medium transition active:scale-[0.96]";

  if (isActive) {
    return (
      <Link
        href={href}
        aria-current="page"
        className={`${base} ${
          highlight
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            : "bg-muted text-foreground"
        }`}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} ${
        highlight
          ? "text-primary hover:bg-primary/10"
          : "text-foreground/70 hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
