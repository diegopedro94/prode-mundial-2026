import Link from "next/link";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  RefreshCw,
  ScrollText,
  Trophy,
  Users,
} from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Tile = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  accent: string;
};

const TILES: Tile[] = [
  {
    title: "Partidos",
    description: "Cargar resultados manualmente y supervisar el sync.",
    href: "/admin/matches",
    icon: <ClipboardList className="h-5 w-5" />,
    accent: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "Rondas y deadlines",
    description: "Editar los locks_at de cada ronda.",
    href: "/admin/rounds",
    icon: <CalendarClock className="h-5 w-5" />,
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Rosters",
    description: "Lockear el pool de jugadores para especiales.",
    href: "/admin/rosters",
    icon: <Trophy className="h-5 w-5" />,
    accent: "text-amber-600 dark:text-amber-400",
  },
  {
    title: "Admins",
    description: "Quién tiene acceso al panel del consejo.",
    href: "/admin/allowed-emails",
    icon: <Users className="h-5 w-5" />,
    accent: "text-rose-600 dark:text-rose-400",
  },
  {
    title: "Sync api-football",
    description: "Estado del cron, errores, requests restantes.",
    href: "/admin/sync",
    icon: <RefreshCw className="h-5 w-5" />,
    accent: "text-violet-600 dark:text-violet-400",
  },
  {
    title: "Audit log",
    description: "Historial de cambios en partidos y configuración.",
    href: "/admin/audit",
    icon: <ScrollText className="h-5 w-5" />,
    accent: "text-muted-foreground",
  },
];

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { count: matchesTotal },
    { count: matchesFinished },
    { count: matchesLive },
    { count: predictionsTotal },
    { count: playersOfficial },
    { data: lastSyncRow },
  ] = await Promise.all([
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "finished"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "live"),
    supabase.from("predictions").select("user_id", { count: "exact", head: true }),
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("is_in_official_roster", true),
    supabase
      .from("sync_log")
      .select("status, started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string; started_at: string }>(),
  ]);

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Consejo del Prode. Estado global y accesos rápidos a las secciones.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Activity className="h-4 w-4" />}
          label="Partidos"
          value={`${matchesFinished ?? 0}/${matchesTotal ?? 0}`}
          hint={matchesLive ? `${matchesLive} en curso` : "ninguno en curso"}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <Stat
          icon={<ClipboardList className="h-4 w-4" />}
          label="Predicciones"
          value={String(predictionsTotal ?? 0)}
          hint="suma de todos los jugadores"
          accent="text-blue-600 dark:text-blue-400"
        />
        <Stat
          icon={<Trophy className="h-4 w-4" />}
          label="Pool de jugadores"
          value={String(playersOfficial ?? 0)}
          hint="oficiales para especiales"
          accent="text-amber-600 dark:text-amber-400"
        />
        <Stat
          icon={<RefreshCw className="h-4 w-4" />}
          label="Último sync"
          value={lastSyncRow ? formatRelative(lastSyncRow.started_at) : "—"}
          hint={lastSyncRow?.status ?? "sin corridas"}
          accent={
            lastSyncRow?.status === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : lastSyncRow?.status === "error"
                ? "text-destructive"
                : "text-muted-foreground"
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow"
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted ${tile.accent}`}
              >
                {tile.icon}
              </span>
              <h2 className="text-base font-semibold">{tile.title}</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{tile.description}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-primary group-hover:translate-x-0.5 transition-transform inline-block">
              Abrir →
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted ${accent}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
}
