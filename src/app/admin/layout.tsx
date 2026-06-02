import Link from "next/link";
import { redirect } from "next/navigation";

import { SoccerBall } from "@/components/icons/soccer-ball";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SECTIONS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/matches", label: "Partidos" },
  { href: "/admin/rounds", label: "Rondas" },
  { href: "/admin/rosters", label: "Rosters" },
  { href: "/admin/allowed-emails", label: "Emails" },
  { href: "/admin/sync", label: "Sync" },
  { href: "/admin/audit", label: "Audit" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, display_name")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean; display_name: string }>();

  if (!profile?.is_admin) {
    redirect("/");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-display text-base font-bold tracking-tight transition active:scale-[0.97]"
          >
            <SoccerBall className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">Consejo del Prode</span>
            <span className="sm:hidden">Consejo</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {profile.display_name}
            </span>
            <Link
              href="/"
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              ← Salir del admin
            </Link>
          </div>
        </div>
        <div className="border-t border-border/40">
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
