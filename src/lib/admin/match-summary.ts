import { teamName } from "@/lib/teams/i18n";

export type SummaryTeam = {
  id: number;
  name: string;
  fifa_code: string;
};

export type SummaryPrediction = {
  home_score: number;
  away_score: number;
  pk_winner_team_id: number | null;
  display_name: string;
};

export type SummaryInput = {
  homeTeam: SummaryTeam;
  awayTeam: SummaryTeam;
  predictions: SummaryPrediction[];
  intro: string | null;
  /** Knockouts get the penalty-bonus section. Group stage skips it. */
  isKnockout: boolean;
};

function joinSpanish(names: string[]): string {
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function scoreLabel(home: number, away: number, homeTeamName: string, awayTeamName: string): string {
  if (home > away) return `Gana ${homeTeamName} ${home}-${away}`;
  if (home < away) return `Gana ${awayTeamName} ${away}-${home}`;
  return `Empatan ${home}-${away}`;
}

/**
 * Order exact scores: home wins first (ascending by home, then ascending by
 * away), then draws (by score), then away wins (ascending by away, then home).
 * Easier for a reader to scan than picking arbitrarily.
 */
function sortScoreKeys(keys: string[]): string[] {
  return keys.slice().sort((ka, kb) => {
    const [ha, aa] = ka.split("-").map(Number) as [number, number];
    const [hb, ab] = kb.split("-").map(Number) as [number, number];
    const dirA = Math.sign(ha - aa); // 1 home, 0 draw, -1 away
    const dirB = Math.sign(hb - ab);
    // home (1) → draw (0) → away (-1)
    if (dirA !== dirB) return dirB - dirA;
    if (dirA === 1) return ha - hb || aa - ab;
    if (dirA === -1) return aa - ab || ha - hb;
    return ha - hb;
  });
}

export function buildMatchSummary(input: SummaryInput): string {
  const home = input.homeTeam;
  const away = input.awayTeam;
  const homeName = teamName(home.fifa_code, home.name);
  const awayName = teamName(away.fifa_code, away.name);

  const lines: string[] = [];

  if (input.intro && input.intro.trim().length > 0) {
    lines.push(input.intro.trim());
    lines.push("");
  }

  // ---- Score exacto ---------------------------------------------------------
  if (input.predictions.length === 0) {
    lines.push(`(Nadie cargó predicción para ${homeName} vs ${awayName}.)`);
    return lines.join("\n");
  }

  lines.push("*Score exacto (+4 pts):*");
  const byScore = new Map<string, string[]>();
  for (const p of input.predictions) {
    const key = `${p.home_score}-${p.away_score}`;
    const arr = byScore.get(key) ?? [];
    arr.push(p.display_name);
    byScore.set(key, arr);
  }
  const sortedKeys = sortScoreKeys([...byScore.keys()]);
  for (const key of sortedKeys) {
    const [hs, as_] = key.split("-").map(Number) as [number, number];
    const label = scoreLabel(hs, as_, homeName, awayName);
    const names = byScore.get(key)!.sort();
    lines.push(`${label}: ${joinSpanish(names)}`);
  }

  // ---- Por ganador ----------------------------------------------------------
  const homeWinners: string[] = [];
  const awayWinners: string[] = [];
  const drawers: string[] = [];
  for (const p of input.predictions) {
    if (p.home_score > p.away_score) homeWinners.push(p.display_name);
    else if (p.home_score < p.away_score) awayWinners.push(p.display_name);
    else drawers.push(p.display_name);
  }
  homeWinners.sort();
  awayWinners.sort();
  drawers.sort();

  lines.push("");
  lines.push("*Acertaron el ganador (+2 pts si no acertaron el score):*");
  if (homeWinners.length) lines.push(`Gana ${homeName}: ${joinSpanish(homeWinners)}`);
  if (awayWinners.length) lines.push(`Gana ${awayName}: ${joinSpanish(awayWinners)}`);
  if (drawers.length) lines.push(`Empate: ${joinSpanish(drawers)}`);
  if (!homeWinners.length && !awayWinners.length && !drawers.length) {
    lines.push("(nadie)");
  }

  // ---- Bonus penales (solo eliminatorias) -----------------------------------
  if (input.isKnockout) {
    const pkHome: string[] = [];
    const pkAway: string[] = [];
    for (const p of input.predictions) {
      if (p.pk_winner_team_id === home.id) pkHome.push(p.display_name);
      else if (p.pk_winner_team_id === away.id) pkAway.push(p.display_name);
    }
    pkHome.sort();
    pkAway.sort();
    if (pkHome.length > 0 || pkAway.length > 0) {
      lines.push("");
      lines.push("*Bonus penales (+1 si efectivamente se define en penales):*");
      if (pkHome.length) lines.push(`Gana ${homeName} en penales: ${joinSpanish(pkHome)}`);
      if (pkAway.length) lines.push(`Gana ${awayName} en penales: ${joinSpanish(pkAway)}`);
    }
  }

  return lines.join("\n");
}
