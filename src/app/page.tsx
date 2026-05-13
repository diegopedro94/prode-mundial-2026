import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Prode Mundial 2026
      </h1>
      <p className="mt-4 max-w-lg text-base text-zinc-600 dark:text-zinc-400">
        Predicciones del grupo. Leaderboard global. Mucho troleo.
      </p>
      <div className="mt-8 flex gap-3">
        {user ? (
          <>
            <Link
              href="/predict/groups"
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Cargar prode
            </Link>
            <Link
              href="/predict/special"
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Especiales
            </Link>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Ingresar
          </Link>
        )}
      </div>
    </main>
  );
}
