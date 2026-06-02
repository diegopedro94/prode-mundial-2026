import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RoundsTable } from "./rounds-table";

type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";

type RoundRow = { stage: Stage; locks_at: string };

const STAGE_ORDER: Stage[] = [
  "group",
  "r32",
  "r16",
  "qf",
  "sf",
  "third_place",
  "final",
];

export default async function AdminRoundsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("rounds").select("stage, locks_at");
  const rounds = ((data ?? []) as RoundRow[]).sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
  );

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Rondas y deadlines</h1>
        <p className="text-sm text-muted-foreground">
          Cuando se llega al <code className="text-xs">locks_at</code> de una ronda, las
          RLS de Postgres bloquean los INSERT/UPDATE de predicciones para esa etapa.
          Los pibes ven el estado read-only en la UI pero la verdad vive en la policy.
        </p>
      </header>
      <RoundsTable rounds={rounds} />
    </section>
  );
}
