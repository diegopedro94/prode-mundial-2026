/**
 * Cache firstname / lastname for every player by hitting
 * api-football's /players/profiles?player=<id>.
 *
 * Why: /players/squads only returns short names ("T. Payne"), which makes
 * searching by first name ("Tim") in /predict/special return nothing.
 *
 * Skips players that already have a firstname set. Re-run after seed:players
 * if api-football adds new substitutes mid-tournament.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProfileResp = {
  errors: unknown;
  response: Array<{
    player: {
      id: number;
      name: string;
      firstname: string | null;
      lastname: string | null;
    };
  }>;
};

async function fetchProfile(playerId: number): Promise<{
  firstname: string | null;
  lastname: string | null;
} | null> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");
  const url = new URL("https://v3.football.api-sports.io/players/profiles");
  url.searchParams.set("player", String(playerId));
  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (!res.ok) {
    console.warn(`  profile ${playerId}: HTTP ${res.status}`);
    return null;
  }
  const body = (await res.json()) as ProfileResp;
  if (
    body.errors &&
    typeof body.errors === "object" &&
    Object.keys(body.errors as object).length > 0
  ) {
    console.warn(`  profile ${playerId}: api errors`, body.errors);
    return null;
  }
  const player = body.response[0]?.player;
  if (!player) return null;
  return { firstname: player.firstname, lastname: player.lastname };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const supabase = createSupabaseAdminClient();

  // Page through players (Supabase REST caps at max_rows=1000 by default).
  const PAGE = 1000;
  const all: Array<{ id: number; external_id: number; name: string }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("players")
      .select("id, external_id, name, firstname")
      .is("firstname", null)
      .not("external_id", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.external_id != null) {
        all.push({ id: row.id, external_id: row.external_id, name: row.name });
      }
    }
    if (data.length < PAGE) break;
  }

  console.log(`Enriching ${all.length} players...`);
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < all.length; i++) {
    const p = all[i]!;
    try {
      const profile = await fetchProfile(p.external_id);
      if (profile && (profile.firstname || profile.lastname)) {
        const { error } = await supabase
          .from("players")
          .update({
            firstname: profile.firstname,
            lastname: profile.lastname,
          })
          .eq("id", p.id);
        if (error) {
          console.warn(`  player ${p.id} update failed: ${error.message}`);
          failed += 1;
        } else {
          updated += 1;
        }
      } else {
        failed += 1;
      }
    } catch (err) {
      console.warn(
        `  player ${p.id} (${p.name}) error:`,
        err instanceof Error ? err.message : err,
      );
      failed += 1;
    }
    if ((i + 1) % 25 === 0) {
      console.log(`  progress ${i + 1}/${all.length} (ok=${updated}, fail=${failed})`);
    }
    // ~6 req/sec — well under Pro plan's 450/min.
    await sleep(170);
  }
  console.log(`\nDone. updated=${updated} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
