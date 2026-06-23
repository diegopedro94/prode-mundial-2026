import Link from "next/link";
import { redirect } from "next/navigation";

import { SoccerBall } from "@/components/icons/soccer-ball";
import { NavLink } from "@/components/nav-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/predict/groups");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string; avatar_url: string | null; is_admin: boolean }>();

  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur">
        {/* Row 1: brand + user controls (avatar + Salir). Always one line. */}
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 font-display text-base font-bold tracking-tight transition active:scale-[0.97]"
          >
            <SoccerBall className="h-6 w-6 shrink-0 text-primary" />
            <span className="hidden truncate sm:inline">Prode Mundial 2026</span>
            <span className="truncate sm:hidden">Prode 2026</span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <UserChip
              name={profile?.display_name ?? "—"}
              avatarUrl={profile?.avatar_url ?? null}
            />
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition active:scale-[0.96] hover:bg-muted hover:text-foreground"
                title="Cerrar sesión"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        {/* Row 2: tab nav. Scrollable on narrow screens, no scrollbar shown. */}
        <div className="border-t border-border/40">
          <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 text-sm sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavLink href="/live">En vivo</NavLink>
            <NavLink href="/predict/groups">Grupos</NavLink>
            <NavLink
              href="/predict/r32"
              matchPaths={[
                "/predict/r16",
                "/predict/qf",
                "/predict/sf",
                "/predict/third",
                "/predict/final",
              ]}
            >
              Elim.
            </NavLink>
            <NavLink href="/predict/special">Especiales</NavLink>
            <NavLink href="/leaderboard">Posiciones</NavLink>
            <NavLink href="/me">Yo</NavLink>
            {profile?.is_admin ? (
              <NavLink href="/admin" matchSubpaths highlight>
                Admin
              </NavLink>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

function UserChip({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-xs sm:flex">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-5 w-5 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
          {initials || "—"}
        </span>
      )}
      <span className="max-w-[120px] truncate">{name}</span>
    </div>
  );
}
