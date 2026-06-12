/**
 * Poll api-football for relevant fixtures and upsert into `matches`.
 *
 * Designed to run from a GitHub Actions cron during the tournament window.
 * Idempotent: only writes rows whose state actually changed.
 *
 * Logs every run to `sync_log` so /admin/sync can show status.
 *
 * The actual sync logic lives in `src/lib/sync/run-sync.ts` so the same
 * function can be invoked from a server action (e.g. when a user opens /live
 * while GHA cron is delayed by GitHub's load).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/sync/run-sync";

async function main() {
  const supabase = createSupabaseAdminClient();

  // Cheap probe (no API hit). Skip logging entirely when there's nothing in
  // flight so sync_log stays signal-only for the cron path.
  const peek = await runSyncPeek(supabase);
  if (peek.kind === "skipped") {
    console.log(`Sync skipped: ${peek.reason}`);
    return;
  }

  const { data: logRow, error: logInsertError } = await supabase
    .from("sync_log")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (logInsertError) {
    console.error("Failed to insert sync_log row:", logInsertError);
    process.exit(1);
  }
  const syncLogId = logRow!.id;

  try {
    const result = await runSync(supabase);
    if (result.kind === "skipped") {
      await supabase
        .from("sync_log")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          fixtures_processed: 0,
          error_message: `skipped: ${result.reason}`,
        })
        .eq("id", syncLogId);
      return;
    }
    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        fixtures_processed: result.fixturesProcessed,
        fixtures_updated: result.fixturesUpdated,
        requests_remaining: result.requestsRemaining,
      })
      .eq("id", syncLogId);
    console.log(
      `Sync ok: ${result.fixturesUpdated}/${result.fixturesProcessed} updated, ${result.goalsUpserted} goals, ${result.requestsRemaining ?? "?"} reqs left.`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Sync failed:", message);
    await supabase
      .from("sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", syncLogId);
    process.exit(1);
  }
}

async function runSyncPeek(
  supabase: SupabaseClient<Database>,
): Promise<{ kind: "skipped"; reason: string } | { kind: "go" }> {
  const now = new Date();
  const imminentCutoff = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const { data: relevant, error } = await supabase
    .from("matches")
    .select("id")
    .or(`status.eq.live,and(status.eq.scheduled,scheduled_at.lte.${imminentCutoff})`)
    .limit(1);
  if (error) throw new Error(`DB probe failed: ${error.message}`);
  if (!relevant || relevant.length === 0) {
    return {
      kind: "skipped",
      reason: "no live or imminent matches",
    };
  }
  return { kind: "go" };
}

main();
