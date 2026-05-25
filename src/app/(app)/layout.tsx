import Link from "next/link";
import { redirect } from "next/navigation";

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
    .select("display_name, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string; is_admin: boolean }>();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight">
            Prode Mundial 2026
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link
              href="/predict/groups"
              className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Grupos
            </Link>
            <Link
              href="/predict/special"
              className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Especiales
            </Link>
            <Link
              href="/leaderboard"
              className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Leaderboard
            </Link>
            <Link
              href="/me"
              className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Mi prode
            </Link>
            {profile?.is_admin ? (
              <Link
                href="/admin"
                className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                Admin
              </Link>
            ) : null}
            <span className="text-zinc-400">|</span>
            <span className="text-zinc-500">{profile?.display_name ?? "—"}</span>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
              >
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
