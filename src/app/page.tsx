import Link from "next/link";

import { Countdown } from "@/components/countdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FIRST_KICKOFF_ISO = "2026-06-11T19:00:00Z"; // Mexico — opening match

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-[320px] w-[320px] rounded-full bg-chart-3/10 blur-3xl" />
      </div>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Mundial 2026 — USA · Canadá · México
        </span>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
          Prode entre amigos.
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
          Cargá tus predicciones de los 104 partidos. El primero que clave la final
          se hace cargo de los asados hasta Qatar 2030.
        </p>

        <div className="mt-10 w-full max-w-sm">
          <Countdown
            target={FIRST_KICKOFF_ISO}
            label="Falta para el primer partido"
            className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm backdrop-blur-sm"
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <>
              <Link
                href="/predict/groups"
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Cargar prode
              </Link>
              <Link
                href="/leaderboard"
                className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium transition hover:bg-muted"
              >
                Ver leaderboard
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Ingresar con Google
            </Link>
          )}
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-3 text-left text-sm">
          <Feature
            title="72 + 32 partidos"
            description="Score exacto vale 4, ganador 2, bonus por penales en eliminatorias."
          />
          <Feature
            title="Especiales"
            description="Campeón, subcampeón, goleador, MVP, mejor arquero."
          />
          <Feature
            title="Sync en vivo"
            description="Resultados de api-football cada 5 min durante los partidos."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
