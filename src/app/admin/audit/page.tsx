import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string | null;
};

type ProfileRow = { id: string; display_name: string };

const TZ = "America/Argentina/Buenos_Aires";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function summarizeMatchUpdate(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string {
  if (!before || !after) return "—";
  const fields = [
    "home_score",
    "away_score",
    "status",
    "went_to_penalties",
    "pk_winner_team_id",
    "winner_team_id",
  ];
  const diffs: string[] = [];
  for (const f of fields) {
    const b = before[f];
    const a = after[f];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diffs.push(`${f}: ${formatVal(b)} → ${formatVal(a)}`);
    }
  }
  return diffs.length ? diffs.join(", ") : "(sin cambios visibles)";
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "boolean") return v ? "sí" : "no";
  return String(v);
}

export default async function AdminAuditPage() {
  const supabase = await createSupabaseServerClient();

  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, before, after, created_at")
    .order("id", { ascending: false })
    .limit(100);
  const rows = (entries ?? []) as AuditRow[];

  // Resolve actor display names in one query.
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_id).filter((x): x is string => x !== null)),
  );
  let profilesById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", actorIds);
    profilesById = new Map(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p.display_name]),
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Últimas 100 mutaciones sobre <code className="text-xs">matches</code>. Actor
          vacío = service role (el sync de api-football).
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay entradas todavía.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground ">
              <tr>
                <th className="px-3 py-2">Cuando</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Acci&oacute;n</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Cambios</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {fmt(r.created_at)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.actor_id ? (
                      profilesById.get(r.actor_id) ?? r.actor_id.slice(0, 8)
                    ) : (
                      <span className="text-muted-foreground/60">sync</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {r.entity}#{r.entity_id}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.action === "matches.update"
                      ? summarizeMatchUpdate(r.before, r.after)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
