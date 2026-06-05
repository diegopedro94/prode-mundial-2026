import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Profiles + the leaderboard RPC are both small (<200 rows for the group of
// friends), but force dynamic anyway so the count reflects real-time signup
// + prediction activity without Next caching it.
export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  exact_count: number;
  scored_count: number;
  predictions_count: number;
};

type AdminFlagRow = { id: string; is_admin: boolean };

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: leaderData, error }, { data: profilesData }] = await Promise.all([
    supabase.rpc("get_leaderboard"),
    supabase.from("profiles").select("id, is_admin"),
  ]);

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Jugadores</h1>
        <p className="text-sm text-destructive">{error.message}</p>
      </section>
    );
  }

  const rows = (leaderData ?? []) as Row[];
  const adminByUser = new Map<string, boolean>(
    ((profilesData ?? []) as AdminFlagRow[]).map((p) => [p.id, p.is_admin]),
  );

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Jugadores
        </h1>
        <p className="text-sm text-muted-foreground">
          Todos los registrados. Click en una fila para ver su prode completo.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Jugador</th>
              <th className="px-3 py-2 text-right">Cargados</th>
              <th className="px-3 py-2 text-right">Puntos</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell">Exactos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isAdmin = adminByUser.get(r.user_id) === true;
              return (
                <tr key={r.user_id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/users/${r.user_id}`}
                      className="flex items-center gap-2 transition active:scale-[0.99]"
                    >
                      <Avatar name={r.display_name} avatarUrl={r.avatar_url} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{r.display_name}</span>
                          {isAdmin ? (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                              admin
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {r.predictions_count}/104
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {r.total_points}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground hidden sm:table-cell">
                    {r.exact_count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay registros.
        </p>
      ) : null}
    </section>
  );
}

function Avatar({
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
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-border"
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initials || "—"}
    </div>
  );
}
