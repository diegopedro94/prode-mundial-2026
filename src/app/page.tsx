import Link from "next/link";
import { Radio } from "lucide-react";

import { Countdown } from "@/components/countdown";
import { SoccerBall } from "@/components/icons/soccer-ball";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FIRST_KICKOFF_ISO = "2026-06-11T19:00:00Z"; // Mexico — opening match

// Verified-200 Unsplash photo (football trophy/scene). Layered with a strong
// dark gradient so even on slow connections (LCP fallback) the page reads.
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&q=85&auto=format&fit=crop";

// Once the tournament is rolling, the home page refreshes itself every minute
// so the live teaser stays current without manual reloads.
export const revalidate = 60;

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const tournamentStarted = now >= new Date(FIRST_KICKOFF_ISO);

  // Only run the cheap "is there a live match right now?" probe once the
  // tournament has actually started — pointless quota burn beforehand.
  let liveCount = 0;
  if (tournamentStarted) {
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "live");
    liveCount = count ?? 0;
  }

  // "Cargar prode" should jump to whatever stage is currently editable, so
  // mid-tournament users don't land on the locked group page. Pick the
  // earliest round whose lock hasn't fired yet.
  const { data: openRound } = await supabase
    .from("rounds")
    .select("stage, locks_at")
    .gt("locks_at", now.toISOString())
    .order("locks_at")
    .limit(1)
    .maybeSingle<{ stage: string; locks_at: string }>();
  const predictHref = openRound ? stageHref(openRound.stage) : "/predict/groups";

  return (
    <main className="relative flex flex-1 flex-col">
      {/* Hero image + dark overlay. The gradient does most of the work; the
          photo gives texture. */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-black/85 via-black/75 to-background"
        aria-hidden="true"
      />

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-20 text-center text-white">
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Mundial 2026 — USA · Canadá · México
        </div>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Prode entre amigos.
        </h1>

        {!tournamentStarted ? (
          <>
            <p className="mt-4 max-w-lg text-base text-white/80 sm:text-lg">
              Cargá tus predicciones de los 104 partidos. El primero que clave la final
              se hace cargo de los asados hasta Qatar 2030.
            </p>
            <div className="mt-10 w-full max-w-sm">
              <Countdown
                target={FIRST_KICKOFF_ISO}
                label="Falta para el primer partido"
                className="rounded-2xl border border-white/15 bg-black/40 p-5 text-white shadow-lg backdrop-blur-md"
              />
            </div>
          </>
        ) : (
          <div className="mt-10 w-full max-w-sm">
            {user ? (
              <Link
                href="/live"
                className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-rose-300/40 bg-rose-500/15 p-5 text-left text-white shadow-lg backdrop-blur-md transition active:scale-[0.98] hover:bg-rose-500/25"
              >
                <div className="flex items-center gap-3">
                  <span className="relative inline-flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                  </span>
                  <div>
                    <div className="text-sm font-bold uppercase tracking-wider">
                      {liveCount > 0 ? "En vivo" : "El Mundial arrancó"}
                    </div>
                    <div className="mt-0.5 text-xs text-white/80">
                      {liveCount > 0
                        ? `${liveCount} partido${liveCount === 1 ? "" : "s"} ahora`
                        : "Mirá los últimos resultados"}
                    </div>
                  </div>
                </div>
                <Radio className="h-5 w-5 text-rose-200 transition group-hover:scale-110" />
              </Link>
            ) : (
              <div className="rounded-2xl border border-rose-300/40 bg-rose-500/15 p-5 text-white shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider">
                  <span className="relative inline-flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                  </span>
                  El Mundial arrancó
                </div>
                <div className="mt-1 text-xs text-white/80">
                  Ingresá para ver el prode y las posiciones.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <>
              <Link
                href={predictHref}
                className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition active:scale-[0.97] hover:bg-emerald-400"
              >
                Cargar prode
              </Link>
              <Link
                href="/leaderboard"
                className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition active:scale-[0.97] hover:bg-white/20"
              >
                Ver posiciones
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition active:scale-[0.97] hover:bg-emerald-400"
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

      <div className="border-t border-border bg-background px-6 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
          <SoccerBall className="h-4 w-4 text-primary" />
          <span>Prode Mundial 2026 · jun–jul 2026</span>
        </div>
      </div>
    </main>
  );
}

function stageHref(stage: string): string {
  switch (stage) {
    case "group":
      return "/predict/groups";
    case "r32":
    case "r16":
    case "qf":
    case "sf":
    case "final":
      return `/predict/${stage}`;
    case "third_place":
      return "/predict/third";
    default:
      return "/predict/groups";
  }
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-xs text-white/70">{description}</p>
    </div>
  );
}
