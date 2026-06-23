/**
 * One-shot script to seed the 32 knockout-stage fixtures for WC 2026.
 *
 * Idempotent: matches an existing row by (stage, scheduled_at) so re-running
 * is safe. Doesn't touch group-stage rows.
 *
 * api-football doesn't publish knockout fixtures until the bracket is set
 * (~end of group stage). We pre-seed dates from the official FIFA schedule
 * so users can see the bracket shell and admin can assign teams the moment
 * groups finish. Once api-football publishes the matches, the import script
 * (TODO) will match by (stage + scheduled_at proximity) and fill in
 * external_id + teams.
 *
 * Also updates rounds.locks_at to the first per-stage kickoff so the RLS
 * lock matches reality.
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type KnockoutMatch = {
  stage: "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
  scheduled_at: string; // UTC ISO
};

// Pulled from the official FIFA WC 2026 schedule (en.wikipedia.org). Times
// are in UTC. If FIFA bumps a kickoff, admin can fix the row from
// /admin/matches; nothing else depends on these exact times beyond the live
// sync window probe.
const KNOCKOUTS: KnockoutMatch[] = [
  // Round of 32 (16 matches) — Jun 28 to Jul 4
  { stage: "r32", scheduled_at: "2026-06-28T19:00:00Z" }, // M73
  { stage: "r32", scheduled_at: "2026-06-29T17:00:00Z" }, // M76
  { stage: "r32", scheduled_at: "2026-06-29T20:30:00Z" }, // M74
  { stage: "r32", scheduled_at: "2026-06-30T01:00:00Z" }, // M75
  { stage: "r32", scheduled_at: "2026-06-30T17:00:00Z" }, // M78
  { stage: "r32", scheduled_at: "2026-06-30T21:00:00Z" }, // M77
  { stage: "r32", scheduled_at: "2026-07-01T01:00:00Z" }, // M79
  { stage: "r32", scheduled_at: "2026-07-01T16:00:00Z" }, // M80
  { stage: "r32", scheduled_at: "2026-07-01T20:00:00Z" }, // M81
  { stage: "r32", scheduled_at: "2026-07-01T20:30:00Z" }, // M82
  { stage: "r32", scheduled_at: "2026-07-02T19:00:00Z" }, // M84
  { stage: "r32", scheduled_at: "2026-07-02T23:00:00Z" }, // M83
  { stage: "r32", scheduled_at: "2026-07-03T02:00:00Z" }, // M85
  { stage: "r32", scheduled_at: "2026-07-03T18:00:00Z" }, // M88
  { stage: "r32", scheduled_at: "2026-07-03T22:00:00Z" }, // M86
  { stage: "r32", scheduled_at: "2026-07-04T01:30:00Z" }, // M87
  // Round of 16 (8 matches) — Jul 4 to Jul 7
  { stage: "r16", scheduled_at: "2026-07-04T17:00:00Z" }, // M90
  { stage: "r16", scheduled_at: "2026-07-04T21:00:00Z" }, // M89
  { stage: "r16", scheduled_at: "2026-07-05T20:00:00Z" }, // M91
  { stage: "r16", scheduled_at: "2026-07-06T02:00:00Z" }, // M92
  { stage: "r16", scheduled_at: "2026-07-06T18:00:00Z" }, // M93
  { stage: "r16", scheduled_at: "2026-07-07T00:00:00Z" }, // M94
  { stage: "r16", scheduled_at: "2026-07-07T16:00:00Z" }, // M95
  { stage: "r16", scheduled_at: "2026-07-07T20:00:00Z" }, // M96
  // Quarterfinals (4 matches) — Jul 9 to Jul 12
  { stage: "qf", scheduled_at: "2026-07-09T20:00:00Z" }, // M97
  { stage: "qf", scheduled_at: "2026-07-10T19:00:00Z" }, // M98
  { stage: "qf", scheduled_at: "2026-07-11T21:00:00Z" }, // M99
  { stage: "qf", scheduled_at: "2026-07-12T01:00:00Z" }, // M100
  // Semifinals (2 matches) — Jul 14 / 15
  { stage: "sf", scheduled_at: "2026-07-14T18:00:00Z" }, // M101
  { stage: "sf", scheduled_at: "2026-07-15T19:00:00Z" }, // M102
  // Third place (Jul 18) + Final (Jul 19)
  { stage: "third_place", scheduled_at: "2026-07-18T21:00:00Z" }, // M103
  { stage: "final", scheduled_at: "2026-07-19T19:00:00Z" }, // M104
];

async function main() {
  const url = process.env.SUPABASE_URL_CLOUD ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY_CLOUD ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL_CLOUD / SUPABASE_SERVICE_ROLE_KEY_CLOUD");
  }
  const admin = createClient<Database>(url, key, { auth: { persistSession: false } });

  // Sanity: every stage should match exactly the expected count.
  const counts = KNOCKOUTS.reduce<Record<string, number>>((acc, m) => {
    acc[m.stage] = (acc[m.stage] ?? 0) + 1;
    return acc;
  }, {});
  const expected = { r32: 16, r16: 8, qf: 4, sf: 2, third_place: 1, final: 1 };
  for (const [stage, n] of Object.entries(expected)) {
    if (counts[stage] !== n) {
      throw new Error(`Stage ${stage}: expected ${n} rows, have ${counts[stage] ?? 0}`);
    }
  }

  // Pull existing knockouts so we can skip rather than duplicate.
  const { data: existing, error: readErr } = await admin
    .from("matches")
    .select("id, stage, scheduled_at")
    .neq("stage", "group");
  if (readErr) throw new Error(readErr.message);

  const existingKey = new Set(
    (existing ?? []).map((m) => `${m.stage}|${m.scheduled_at}`),
  );

  const toInsert = KNOCKOUTS.filter(
    (k) => !existingKey.has(`${k.stage}|${k.scheduled_at}`),
  );

  if (toInsert.length === 0) {
    console.log(`Knockouts already seeded (${existing?.length ?? 0} rows). Nothing to do.`);
  } else {
    const { error: insertErr } = await admin.from("matches").insert(
      toInsert.map((k) => ({
        stage: k.stage,
        scheduled_at: k.scheduled_at,
        status: "scheduled" as const,
        went_to_penalties: false,
      })),
    );
    if (insertErr) throw new Error(insertErr.message);
    console.log(`Inserted ${toInsert.length} knockout fixture rows.`);
  }

  // Sync rounds.locks_at to the first kickoff per stage. The RLS policy keys
  // off this column, so a stale value would either lock too early or leak
  // edits past kickoff.
  const firstByStage = new Map<string, string>();
  for (const k of KNOCKOUTS) {
    const cur = firstByStage.get(k.stage);
    if (!cur || k.scheduled_at < cur) firstByStage.set(k.stage, k.scheduled_at);
  }

  for (const [stage, firstAt] of firstByStage) {
    const stageEnum = stage as KnockoutMatch["stage"];
    const { data: round } = await admin
      .from("rounds")
      .select("stage, locks_at")
      .eq("stage", stageEnum)
      .maybeSingle<{ stage: string; locks_at: string }>();
    if (!round) {
      console.warn(`rounds row for stage="${stage}" missing — skipping locks_at sync.`);
      continue;
    }
    if (round.locks_at === firstAt) {
      console.log(`rounds[${stage}].locks_at already ${firstAt}.`);
      continue;
    }
    const { error } = await admin
      .from("rounds")
      .update({ locks_at: firstAt })
      .eq("stage", stageEnum);
    if (error) {
      console.error(`Failed to update rounds[${stage}]:`, error.message);
      continue;
    }
    console.log(`rounds[${stage}].locks_at: ${round.locks_at} -> ${firstAt}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
