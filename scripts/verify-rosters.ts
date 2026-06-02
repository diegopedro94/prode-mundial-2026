/**
 * Cross-check what's in our `players` table against the official 26-man
 * rosters listed on Wikipedia's `2026 FIFA World Cup squads` article.
 *
 * Output is a per-team diff: matched / missing-in-DB / extra-in-DB. Use it
 * before clicking "Lock rosters" in /admin/rosters.
 *
 * No DB writes. Read-only verification.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads";

// Wikipedia article uses some labels that differ from api-football team names.
// Keyed by Wikipedia heading text, value is the FIFA code in our `teams` table.
// Anything not in this map falls back to a fuzzy team-name lookup.
const WP_TO_FIFA: Record<string, string> = {
  Brazil: "BRA",
  Argentina: "ARG",
  France: "FRA",
  Germany: "GER",
  Spain: "SPA",
  England: "ENG",
  Portugal: "POR",
  Netherlands: "NET",
  Belgium: "BEL",
  Italy: "ITA",
  Croatia: "CRO",
  Switzerland: "SWI",
  Sweden: "SWE",
  Norway: "NOR",
  Scotland: "SCO",
  Austria: "AUT",
  "Czech Republic": "CZE",
  Turkey: "TUR",
  "Bosnia and Herzegovina": "BOS",
  "United States": "USA",
  Canada: "CAN",
  Mexico: "MEX",
  Panama: "PAN",
  Haiti: "HAI",
  "Cape Verde": "CAP",
  Curaçao: "CUW",
  Uruguay: "URU",
  Paraguay: "PAR",
  Colombia: "COL",
  Ecuador: "ECU",
  Algeria: "ALG",
  Morocco: "MOR",
  Tunisia: "TUN",
  Egypt: "EGY",
  Senegal: "SEN",
  Ghana: "GHA",
  "Ivory Coast": "IVO",
  "DR Congo": "CON",
  "South Africa": "SOU",
  Iran: "IRN",
  Iraq: "IRQ",
  Japan: "JAP",
  "South Korea": "KOR",
  Australia: "AUS",
  "New Zealand": "ZEA",
  "Saudi Arabia": "SAU",
  Qatar: "QAT",
  Jordan: "JOR",
  Uzbekistan: "UZB",
};

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks (accents)
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
  if (na.includes(nb) || nb.includes(na)) return true;
  // Last name fallback: covers "Alisson Becker" vs "Alisson" but only when
  // the simpler name is just the lastname-equivalent.
  const la = lastName(a);
  const lb = lastName(b);
  if (la && la === lb && la.length >= 4) return true;
  return false;
}

type WpPlayer = { name: string; pos: string };

async function fetchWikipediaRosters(): Promise<Map<string, WpPlayer[]>> {
  const res = await fetch(WIKIPEDIA_URL, {
    headers: { "User-Agent": "prode-mundial-2026/1.0 (verify-rosters script)" },
  });
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
  const html = await res.text();

  // Find each <h3 id="..."> heading and split into sections.
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
      const pos = cleaned[1] ?? "";
      if (!["GK", "DF", "MF", "FW"].includes(pos)) continue;
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
  const wpRosters = await fetchWikipediaRosters();
  console.log(`  -> ${wpRosters.size} teams parsed`);

  const supabase = createSupabaseAdminClient();

  console.log("Loading our DB rosters...");
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, fifa_code");
  if (teamsError) throw teamsError;
  const teamsByFifa = new Map((teams ?? []).map((t) => [t.fifa_code, t]));

  // Supabase REST caps responses at max_rows (1000 by default). Paginate so we
  // don't silently truncate teams that fall past the cutoff.
  const PAGE = 1000;
  const dbByTeam = new Map<number, Array<{ id: number; name: string }>>();
  let fetched = 0;
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabase
      .from("players")
      .select("id, name, team_id")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!page || page.length === 0) break;
    for (const p of page) {
      const arr = dbByTeam.get(p.team_id) ?? [];
      arr.push({ id: p.id, name: p.name });
      dbByTeam.set(p.team_id, arr);
    }
    fetched += page.length;
    if (page.length < PAGE) break;
  }
  console.log(`  -> ${fetched} player rows across ${dbByTeam.size} teams`);

  console.log();
  let teamsClean = 0;
  let teamsIssues = 0;
  const issuesReport: string[] = [];

  for (const [wpLabel, wpPlayers] of wpRosters.entries()) {
    const fifa = WP_TO_FIFA[wpLabel];
    if (!fifa) continue;
    const team = teamsByFifa.get(fifa);
    if (!team) {
      console.log(`✗ ${wpLabel.padEnd(25)} no team in DB with fifa_code=${fifa}`);
      teamsIssues += 1;
      continue;
    }
    const ours = dbByTeam.get(team.id) ?? [];
    const wpUnmatched = wpPlayers.filter(
      (wp) => !ours.some((our) => namesMatch(wp.name, our.name)),
    );
    const ourUnmatched = ours.filter(
      (our) => !wpPlayers.some((wp) => namesMatch(wp.name, our.name)),
    );

    const isClean =
      wpUnmatched.length === 0 && ours.length === wpPlayers.length;
    if (isClean) {
      console.log(
        `✓ ${team.name.padEnd(25)} ${ours.length} = Wikipedia (${wpPlayers.length})`,
      );
      teamsClean += 1;
    } else {
      teamsIssues += 1;
      console.log(
        `✗ ${team.name.padEnd(25)} DB ${ours.length}, WP ${wpPlayers.length}` +
          ` (missing ${wpUnmatched.length}, extra ${ourUnmatched.length})`,
      );
      const lines: string[] = [];
      if (wpUnmatched.length > 0) {
        lines.push(`  Missing from DB:`);
        for (const p of wpUnmatched) lines.push(`    - ${p.pos} ${p.name}`);
      }
      if (ourUnmatched.length > 0) {
        lines.push(`  Extra in DB:`);
        for (const p of ourUnmatched) lines.push(`    + ${p.name}`);
      }
      issuesReport.push(`\n${team.name} (${fifa}):\n${lines.join("\n")}`);
    }
  }

  console.log();
  console.log(`Summary: ${teamsClean} clean, ${teamsIssues} with issues.`);
  if (issuesReport.length > 0) {
    console.log("\n========== DETAIL ==========");
    console.log(issuesReport.join(""));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
