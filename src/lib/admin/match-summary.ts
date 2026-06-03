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

/** "suma" for one person, "suman" for many. */
function suma(names: string[]): string {
  return names.length === 1 ? "suma" : "suman";
}

/**
 * Order exact scores: home wins first (ascending by home, then ascending by
 * away), then draws (by score), then away wins (ascending by away, then home).
 */
function sortScoreKeys(keys: string[]): string[] {
  return keys.slice().sort((ka, kb) => {
    const [ha, aa] = ka.split("-").map(Number) as [number, number];
    const [hb, ab] = kb.split("-").map(Number) as [number, number];
    const dirA = Math.sign(ha - aa); // 1 home, 0 draw, -1 away
    const dirB = Math.sign(hb - ab);
    if (dirA !== dirB) return dirB - dirA;
    if (dirA === 1) return ha - hb || aa - ab;
    if (dirA === -1) return aa - ab || ha - hb;
    return ha - hb;
  });
}

export function buildMatchSummary(input: SummaryInput): string {
  const homeName = teamName(input.homeTeam.fifa_code, input.homeTeam.name);
  const awayName = teamName(input.awayTeam.fifa_code, input.awayTeam.name);

  const lines: string[] = [];
  if (input.intro && input.intro.trim().length > 0) {
    lines.push(input.intro.trim());
    lines.push("");
  }

  if (input.predictions.length === 0) {
    lines.push(`(Nadie cargó predicción para ${homeName} vs ${awayName}.)`);
    return lines.join("\n");
  }

  // ---- Section 1: por ganador (sin puntos: incluye exactos y solo-ganador)
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

  if (homeWinners.length)
    lines.push(`Si gana ${homeName}, ${joinSpanish(homeWinners)} ${suma(homeWinners)}`);
  if (awayWinners.length)
    lines.push(`Si gana ${awayName}, ${joinSpanish(awayWinners)} ${suma(awayWinners)}`);
  if (drawers.length)
    lines.push(`Si empatan, ${joinSpanish(drawers)} ${suma(drawers)}`);

  // ---- Section 2: por score exacto (4 pts)
  lines.push("");
  const byScore = new Map<string, string[]>();
  for (const p of input.predictions) {
    const key = `${p.home_score}-${p.away_score}`;
    const arr = byScore.get(key) ?? [];
    arr.push(p.display_name);
    byScore.set(key, arr);
  }
  for (const key of sortScoreKeys([...byScore.keys()])) {
    const [hs, as_] = key.split("-").map(Number) as [number, number];
    const names = byScore.get(key)!.slice().sort();
    let prefix: string;
    if (hs > as_) prefix = `Si gana ${homeName} ${hs}-${as_}`;
    else if (hs < as_) prefix = `Si gana ${awayName} ${as_}-${hs}`;
    else prefix = `Si empatan ${hs}-${as_}`;
    lines.push(`${prefix}, ${joinSpanish(names)} ${suma(names)} 4 pts`);
  }

  // ---- Section 3: bonus penales (solo eliminatorias)
  if (input.isKnockout) {
    const pkHome: string[] = [];
    const pkAway: string[] = [];
    for (const p of input.predictions) {
      if (p.pk_winner_team_id === input.homeTeam.id) pkHome.push(p.display_name);
      else if (p.pk_winner_team_id === input.awayTeam.id) pkAway.push(p.display_name);
    }
    pkHome.sort();
    pkAway.sort();
    if (pkHome.length > 0 || pkAway.length > 0) {
      lines.push("");
      if (pkHome.length)
        lines.push(
          `Si ${homeName} gana en penales, ${joinSpanish(pkHome)} ${suma(pkHome)} +1`,
        );
      if (pkAway.length)
        lines.push(
          `Si ${awayName} gana en penales, ${joinSpanish(pkAway)} ${suma(pkAway)} +1`,
        );
    }
  }

  return lines.join("\n");
}
