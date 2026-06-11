"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runSync } from "@/lib/sync/run-sync";

// Don't let a flood of /live opens hammer api-football. If the last sync
// started less than RATE_LIMIT_MS ago we treat it as already-fresh.
const RATE_LIMIT_MS = 60 * 1000;

export type TriggerLiveSyncResult =
  | { ok: true; ran: boolean; reason?: string }
  | { ok: false; error: string };

/**
 * Run the api-football sync on demand, gated by an authenticated session and
 * a per-deployment rate limit driven by sync_log.started_at.
 *
 * Intended caller: the AutoRefresh hook on /live. The GHA cron stays as a
 * fallback for periods when nobody has the live tab open.
 */
export async function triggerLiveSync(): Promise<TriggerLiveSyncResult> {
  const userClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { ok: false, error: "no session" };

  const admin = createSupabaseAdminClient();

  // Cheap rate-limit check: when was the last sync_log row started?
  const { data: lastSync } = await admin
    .from("sync_log")
    .select("started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ started_at: string }>();

  if (lastSync) {
    const ageMs = Date.now() - new Date(lastSync.started_at).getTime();
    if (ageMs < RATE_LIMIT_MS) {
      return { ok: true, ran: false, reason: "rate-limited" };
    }
  }

  // Reserve the slot before doing work so two concurrent calls don't both
  // proceed and hit api-football twice.
  const { data: logRow, error: insertError } = await admin
    .from("sync_log")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (insertError || !logRow) {
    return { ok: false, error: insertError?.message ?? "no log row" };
  }

  try {
    const result = await runSync(admin);
    if (result.kind === "skipped") {
      await admin
        .from("sync_log")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          fixtures_processed: 0,
          error_message: `skipped: ${result.reason}`,
        })
        .eq("id", logRow.id);
      return { ok: true, ran: false, reason: result.reason };
    }
    await admin
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        fixtures_processed: result.fixturesProcessed,
        fixtures_updated: result.fixturesUpdated,
        requests_remaining: result.requestsRemaining,
      })
      .eq("id", logRow.id);
    return { ok: true, ran: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", logRow.id);
    return { ok: false, error: message };
  }
}
