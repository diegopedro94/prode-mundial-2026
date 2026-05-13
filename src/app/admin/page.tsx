const tiles = [
  {
    title: "Partidos del día",
    description: "Cargar resultados manualmente y supervisar el sync con api-football.",
    href: "/admin/matches",
    available: false,
  },
  {
    title: "Rondas y deadlines",
    description: "Editar los locks_at de cada ronda eliminatoria.",
    href: "/admin/rounds",
    available: false,
  },
  {
    title: "Lock rosters",
    description: "Congelar la lista oficial de jugadores para los especiales.",
    href: "/admin/rosters",
    available: false,
  },
  {
    title: "Whitelist de emails",
    description: "Invitar o revocar acceso al prode.",
    href: "/admin/allowed-emails",
    available: false,
  },
  {
    title: "Estado del sync",
    description: "Último poll, errores, requests restantes del día.",
    href: "/admin/sync",
    available: false,
  },
  {
    title: "Audit log",
    description: "Historial de cambios en partidos y configuración.",
    href: "/admin/audit",
    available: false,
  },
];

export default function AdminDashboardPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Esqueleto inicial. Las secciones se van habilitando en Fase 2.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
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
        ))}
      </div>
    </section>
  );
}
