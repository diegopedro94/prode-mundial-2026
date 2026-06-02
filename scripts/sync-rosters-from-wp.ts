/**
 * Sync players + official-roster flags from Wikipedia's "2026 FIFA World
 * Cup squads" article.
 *
 * Why this exists:
 * api-football's /players/squads endpoint returns "current" national-team
 * squads (latest friendly callups), which lag significantly behind FIFA's
 * official 26-man WC roster deadline. Wikipedia, in contrast, is curated
 * within hours of each federation's announcement and is the most reliable
 * pre-tournament source for the canonical 26-man lists.
 *
 * Behavior:
 * For each team where Wikipedia has exactly 26 players (final-list teams),
 *   1. ensure every WP player exists in `players` (insert with external_id=null
 *      if missing — we'll resolve api-football ids lazily later if needed)
 *   2. set is_in_official_roster=true for those 26
 *   3. set is_in_official_roster=false for any extra provisional rows on
 *      that team — keeps the pool clean for the specials selectors
 * Teams without a complete WP list (preliminary 52-man rosters, etc.) are
 * skipped and reported. Re-run when Wikipedia updates them.
 *
 * Idempotent: safe to re-run as Wikipedia evolves.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads";

// Wikipedia heading text → FIFA code in our `teams` table.
const WP_TO_FIFA: Record<string, string> = {
  Brazil: "BRA", Argentina: "ARG", France: "FRA", Germany: "GER",
  Spain: "SPA", England: "ENG", Portugal: "POR", Netherlands: "NET",
  Belgium: "BEL", Croatia: "CRO", Switzerland: "SWI", Sweden: "SWE",
  Norway: "NOR", Scotland: "SCO", Austria: "AUT", "Czech Republic": "CZE",
  Turkey: "TUR", "Bosnia and Herzegovina": "BOS", "United States": "USA",
  Canada: "CAN", Mexico: "MEX", Panama: "PAN", Haiti: "HAI",
  "Cape Verde": "CAP", Curaçao: "CUW", Uruguay: "URU", Paraguay: "PAR",
  Colombia: "COL", Ecuador: "ECU", Algeria: "ALG", Morocco: "MOR",
  Tunisia: "TUN", Egypt: "EGY", Senegal: "SEN", Ghana: "GHA",
  "Ivory Coast": "IVO", "DR Congo": "CON", "South Africa": "SOU",
  Iran: "IRN", Iraq: "IRQ", Japan: "JAP", "South Korea": "KOR",
  Australia: "AUS", "New Zealand": "ZEA", "Saudi Arabia": "SAU",
  Qatar: "QAT", Jordan: "JOR", Uzbekistan: "UZB",
};

const POS_MAP: Record<string, "GK" | "DEF" | "MID" | "FWD"> = {
  GK: "GK", DF: "DEF", MF: "MID", FW: "FWD",
};

type WpPlayer = { name: string; pos: "GK" | "DEF" | "MID" | "FWD" };

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function lastName(name: string): string {
  const parts = normalize(name).split(" ");
  return parts[parts.length - 1] ?? "";
}

function namesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.length > 3 && nb.length > 3 && (na.includes(nb) || nb.includes(na))) return true;
  const la = lastName(a);
  const lb = lastName(b);
  if (la && la === lb && la.length >= 4) return true;
  return false;
}

async function fetchWikipediaRosters(): Promise<Map<string, WpPlayer[]>> {
  const res = await fetch(WIKIPEDIA_URL, {
    headers: { "User-Agent": "prode-mundial-2026/1.0 (sync-rosters-from-wp)" },
  });
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
  const html = await res.text();

  const headingRegex = /<h3 id="([^"]+)">([^<]+)<\/h3>/g;
  const headings: Array<{ index: number; anchor: string; label: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({ index: match.index, anchor: match[1]!, label: match[2]! });
  }

  const result = new Map<string, WpPlayer[]>();
  for (let i = 0; i < headings.length; i++) {
    const { label, index } = headings[i]!;
    if (!WP_TO_FIFA[label]) continue;
    const next = headings[i + 1];
    const section = html.slice(index, next ? next.index : html.length);

    const players: WpPlayer[] = [];
    const trRegex = /<tr[^>]*>([\s\S]+?)<\/tr>/g;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(section)) !== null) {
      const tr = trMatch[1]!;
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]+?)<\/t[dh]>/g;
      let cm: RegExpExecArray | null;
      while ((cm = cellRegex.exec(tr)) !== null) cells.push(cm[1]!);
      if (cells.length < 7) continue;
      const cleaned = cells.map((c) =>
        c
          .replace(/<span style="display:none">[\s\S]*?<\/span>/g, "")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      );
      const rawPos = cleaned[1] ?? "";
      const pos = POS_MAP[rawPos];
      if (!pos) continue;
      const rawName = cleaned[2] ?? "";
      const name = rawName.replace(/\s*\(captain\)\s*$/, "").trim();
      players.push({ name, pos });
    }
    result.set(label, players);
  }
  return result;
}

async function main() {
  console.log("Fetching Wikipedia rosters...");
  const wp = await fetchWikipediaRosters();
  console.log(`  -> ${wp.size} teams parsed`);

  const supabase = createSupabaseAdminClient();

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, fifa_code");
  if (teamsError) throw teamsError;
  const teamsByFifa = new Map((teams ?? []).map((t) => [t.fifa_code, t]));

  let teamsProcessed = 0;
  let teamsSkipped = 0;
  let playersInserted = 0;
  let playersMarkedOfficial = 0;
  let playersDemoted = 0;
  const skipped: string[] = [];

  for (const [wpLabel, wpPlayers] of wp.entries()) {
    const fifa = WP_TO_FIFA[wpLabel];
    if (!fifa) continue;
    const team = teamsByFifa.get(fifa);
    if (!team) {
      console.log(`  ✗ ${wpLabel}: no team in DB with fifa_code=${fifa}`);
      continue;
    }

    if (wpPlayers.length !== 26) {
      console.log(
        `  ⊘ ${team.name.padEnd(22)} Wikipedia has ${wpPlayers.length} players (not final yet, skipping)`,
      );
      teamsSkipped += 1;
      skipped.push(`${team.name} (${wpPlayers.length} on Wikipedia)`);
      continue;
    }

    // Paginate existing players for this team.
    const dbPlayers: Array<{ id: number; name: string; is_in_official_roster: boolean }> = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabase
        .from("players")
        .select("id, name, is_in_official_roster")
        .eq("team_id", team.id)
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      if (!page || page.length === 0) break;
      dbPlayers.push(...page);
      if (page.length < 1000) break;
    }

    const officialIds: number[] = [];
    const claimed = new Set<number>();
    const toInsert: Array<{ team_id: number; name: string; position: "GK" | "DEF" | "MID" | "FWD"; is_in_official_roster: true }> = [];

    // Match each WP player to a *unique* DB row. Without the `claimed` guard,
    // when two WP entries share a surname (e.g. Brazil has two "Danilo"s),
    // both would resolve to the same DB row and the second one would silently
    // disappear from the official pool.
    for (const wpPlayer of wpPlayers) {
      const match = dbPlayers.find(
        (d) => !claimed.has(d.id) && namesMatch(wpPlayer.name, d.name),
      );
      if (match) {
        claimed.add(match.id);
        officialIds.push(match.id);
      } else {
        toInsert.push({
          team_id: team.id,
          name: wpPlayer.name,
          position: wpPlayer.pos,
          is_in_official_roster: true,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from("players")
        .insert(toInsert)
        .select("id");
      if (error) throw error;
      for (const row of inserted ?? []) officialIds.push(row.id);
      playersInserted += inserted?.length ?? 0;
    }

    // 1) Demote everyone on this team to false
    const { error: demoteError, count: demotedCount } = await supabase
      .from("players")
      .update({ is_in_official_roster: false }, { count: "exact" })
      .eq("team_id", team.id)
      .eq("is_in_official_roster", true);
    if (demoteError) throw demoteError;

    // 2) Promote only the 26 official ones
    const { error: promoteError, count: promotedCount } = await supabase
      .from("players")
      .update({ is_in_official_roster: true }, { count: "exact" })
      .in("id", officialIds);
    if (promoteError) throw promoteError;

    playersDemoted += demotedCount ?? 0;
    playersMarkedOfficial += promotedCount ?? 0;
    teamsProcessed += 1;

    const insertNote = toInsert.length > 0 ? ` (+${toInsert.length} new)` : "";
    console.log(
      `  ✓ ${team.name.padEnd(22)} ${promotedCount ?? 0}/26 marked official${insertNote}`,
    );
  }

  console.log();
  console.log(`Teams processed:        ${teamsProcessed}`);
  console.log(`Teams skipped:          ${teamsSkipped}`);
  console.log(`Players inserted:       ${playersInserted}`);
  console.log(`Players marked official:${playersMarkedOfficial}`);
  console.log(`Players demoted:        ${playersDemoted}`);
  if (skipped.length > 0) {
    console.log(`\nSkipped teams (Wikipedia still preliminary, re-run later):`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
