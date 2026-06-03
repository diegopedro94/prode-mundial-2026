import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AllowedEmailsManager, type AllowedEmailRow } from "./allowed-emails-manager";

type DbRow = {
  email: string;
  is_admin: boolean;
  added_at: string;
  added_by: string | null;
};

type ProfileRow = { id: string; display_name: string };

export default async function AdminAllowedEmailsPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: emails }, { data: user }] = await Promise.all([
    supabase
      .from("allowed_emails")
      .select("email, is_admin, added_at, added_by")
      .order("added_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const rows = (emails ?? []) as DbRow[];

  const adderIds = Array.from(
    new Set(rows.map((r) => r.added_by).filter((x): x is string => x !== null)),
  );
  let profilesById = new Map<string, string>();
  if (adderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", adderIds);
    profilesById = new Map(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p.display_name]),
    );
  }

  const enriched: AllowedEmailRow[] = rows.map((r) => ({
    email: r.email,
    isAdmin: r.is_admin,
    addedAt: r.added_at,
    addedBy: r.added_by ? (profilesById.get(r.added_by) ?? "—") : "—",
  }));

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Admins
        </h1>
        <p className="text-sm text-muted-foreground">
          El registro est&aacute; abierto: cualquiera con Google entra. Esta lista
          marca qui&eacute;n tiene acceso al panel de admin (ver resultados, lockear
          rondas, generar summaries para WhatsApp).
        </p>
      </header>
      <AllowedEmailsManager
        rows={enriched}
        currentUserEmail={user.user?.email ?? null}
      />
    </section>
  );
}
