import { redirect } from "next/navigation";

import { LoginButton } from "@/app/login/login-button";
import { SoccerBall } from "@/components/icons/soccer-ball";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <SoccerBall className="h-14 w-14 text-primary drop-shadow-md" />
          <h1 className="mt-4 font-display text-xl font-bold tracking-tight">
            Prode Mundial 2026
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo emails autorizados. Pedile al admin que te agregue si todav&iacute;a no
            est&aacute;s.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <LoginButton />

        <p className="text-center text-xs text-muted-foreground">
          Al ingresar acept&aacute;s que tu nombre p&uacute;blico aparezca en el
          leaderboard del grupo.
        </p>
      </div>
    </main>
  );
}
