import Link from "next/link";

const tiles = [
  {
    title: "Partidos",
    description: "Cargar resultados manualmente y supervisar el sync.",
    href: "/admin/matches",
    available: true,
  },
  {
    title: "Rondas y deadlines",
    description: "Editar los locks_at de cada ronda.",
    href: "/admin/rounds",
    available: true,
  },
  {
    title: "Lock rosters",
    description: "Congelar la lista oficial de jugadores para especiales.",
    href: "/admin/rosters",
    available: true,
  },
  {
    title: "Whitelist de emails",
    description: "Invitar o revocar acceso al prode.",
    href: "/admin/allowed-emails",
    available: true,
  },
  {
    title: "Estado del sync",
    description: "Último poll, errores, requests restantes del día.",
    href: "/admin/sync",
    available: true,
  },
  {
    title: "Audit log",
    description: "Historial de cambios en partidos y configuración.",
    href: "/admin/audit",
    available: true,
  },
];

export default function AdminDashboardPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Consejo del Prode. Las secciones grises se van habilitando en Fase 2.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) =>
          tile.available ? (
            <Link
              key={tile.href}
              href={tile.href}
              className="rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
            >
              <h2 className="text-base font-medium">{tile.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {tile.description}
              </p>
              <p className="mt-3 text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Abrir &rarr;
              </p>
            </Link>
          ) : (
            <div
              key={tile.href}
              className="rounded-2xl border border-zinc-200 bg-white p-5 opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <h2 className="text-base font-medium">{tile.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {tile.description}
              </p>
              <p className="mt-3 text-xs uppercase tracking-wider text-zinc-400">
                Pr&oacute;ximamente
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
