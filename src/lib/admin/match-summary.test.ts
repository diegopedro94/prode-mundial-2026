import { describe, expect, it } from "vitest";

import { buildMatchSummary, type SummaryPrediction } from "./match-summary";

const ARG = { id: 1, name: "Argentina", fifa_code: "ARG" };
const BRA = { id: 2, name: "Brazil", fifa_code: "BRA" };

function pred(
  home: number,
  away: number,
  name: string,
  pk: number | null = null,
): SummaryPrediction {
  return { home_score: home, away_score: away, pk_winner_team_id: pk, display_name: name };
}

describe("buildMatchSummary", () => {
  it("places the intro above the auto-generated sections", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [pred(2, 1, "Diego")],
      intro: "Se viene el clásico",
      isKnockout: false,
    });
    expect(out.split("\n")[0]).toBe("Se viene el clásico");
  });

  it("renders winner section first (no points), then exact-score section (4 pts)", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [
        pred(2, 1, "Ana"),
        pred(1, 0, "Bea"),
        pred(0, 2, "Caro"),
        pred(1, 1, "Diego"),
      ],
      intro: null,
      isKnockout: false,
    });
    const winnerLine = out.indexOf("Si gana Argentina, Ana y Bea suman");
    const exactLine = out.indexOf("Si gana Argentina 1-0, Bea suma 4 pts");
    expect(winnerLine).toBeGreaterThan(-1);
    expect(exactLine).toBeGreaterThan(winnerLine);
  });

  it("uses singular 'suma' for one person, plural 'suman' for two+", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [pred(2, 1, "Solo"), pred(0, 1, "Ana"), pred(0, 1, "Bea")],
      intro: null,
      isKnockout: false,
    });
    expect(out).toContain("Si gana Argentina, Solo suma");
    expect(out).toContain("Si gana Brasil, Ana y Bea suman");
    expect(out).toContain("Si gana Argentina 2-1, Solo suma 4 pts");
    expect(out).toContain("Si gana Brasil 1-0, Ana y Bea suman 4 pts");
  });

  it("uses 'Si empatan' for tied predictions (no team name)", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [pred(1, 1, "Ana"), pred(2, 2, "Bea")],
      intro: null,
      isKnockout: false,
    });
    expect(out).toContain("Si empatan, Ana y Bea suman");
    expect(out).toContain("Si empatan 1-1, Ana suma 4 pts");
    expect(out).toContain("Si empatan 2-2, Bea suma 4 pts");
  });

  it("orders exact scores: home wins → draws → away wins, ascending", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [
        pred(2, 1, "A"),
        pred(1, 1, "B"),
        pred(0, 2, "C"),
        pred(3, 1, "D"),
        pred(0, 1, "E"),
      ],
      intro: null,
      isKnockout: false,
    });
    const idxArg21 = out.indexOf("Si gana Argentina 2-1");
    const idxArg31 = out.indexOf("Si gana Argentina 3-1");
    const idxEmp = out.indexOf("Si empatan 1-1");
    const idxBra10 = out.indexOf("Si gana Brasil 1-0");
    const idxBra20 = out.indexOf("Si gana Brasil 2-0");
    expect(idxArg21).toBeLessThan(idxArg31);
    expect(idxArg31).toBeLessThan(idxEmp);
    expect(idxEmp).toBeLessThan(idxBra10);
    expect(idxBra10).toBeLessThan(idxBra20);
  });

  it("skips penalty section for group-stage matches", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [pred(1, 1, "Ana", ARG.id), pred(1, 1, "Bea", BRA.id)],
      intro: null,
      isKnockout: false,
    });
    expect(out).not.toContain("en penales");
  });

  it("renders penalty section for knockouts when at least one pk is predicted", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [
        pred(1, 1, "Ana", ARG.id),
        pred(1, 1, "Bea", BRA.id),
        pred(2, 0, "Caro"),
      ],
      intro: null,
      isKnockout: true,
    });
    expect(out).toContain("Si Argentina gana en penales, Ana suma +1");
    expect(out).toContain("Si Brasil gana en penales, Bea suma +1");
  });

  it("uses 'A, B y C' (no oxford comma) for three+ names", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [pred(2, 1, "Ana"), pred(2, 1, "Bea"), pred(2, 1, "Caro")],
      intro: null,
      isKnockout: false,
    });
    expect(out).toContain("Ana, Bea y Caro");
  });

  it("renders empty-state message when no predictions", () => {
    const out = buildMatchSummary({
      homeTeam: ARG,
      awayTeam: BRA,
      predictions: [],
      intro: null,
      isKnockout: false,
    });
    expect(out).toContain("Nadie cargó predicción");
  });

  // Replays the example the user pasted (PSG vs Atlético, ~17 predictions)
  // verbatim — used as a canary that the wording stays close to what the
  // group's used to reading on WhatsApp.
  it("reproduces the user's PSG vs Aleti example", () => {
    // ZZZ / YYY aren't in the FIFA→Spanish map, so the raw name passes through.
    const PSG = { id: 100, name: "PSG", fifa_code: "ZZZ" };
    const ALETI = { id: 200, name: "Aleti", fifa_code: "YYY" };

    const predictions: SummaryPrediction[] = [
      // PSG 2-1 → 9 people
      pred(2, 1, "Rebit"),
      pred(2, 1, "Gonza B"),
      pred(2, 1, "De Santa"),
      pred(2, 1, "Rod"),
      pred(2, 1, "Pablo P"),
      pred(2, 1, "Aran"),
      pred(2, 1, "Pablo R"),
      pred(2, 1, "Kelo"),
      pred(2, 1, "Nikito"),
      // PSG 3-1 → 1 person
      pred(3, 1, "Diegui"),
      // Aleti 1-0 (away wins 1-0 with PSG=home) → 1
      pred(0, 1, "Niki"),
      // Aleti 2-1 → 1
      pred(1, 2, "Uri"),
      // 1-1 draws → 3
      pred(1, 1, "Chacho"),
      pred(1, 1, "Marta"),
      pred(1, 1, "Lu"),
      // 2-2 draws → 2
      pred(2, 2, "Manu"),
      pred(2, 2, "Miks"),
    ];

    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: ALETI,
      predictions,
      intro: null,
      isKnockout: false,
    });

    // -------- Section 1: por ganador (sin puntos) --------
    expect(out).toContain(
      "Si gana PSG, Aran, De Santa, Diegui, Gonza B, Kelo, Nikito, Pablo P, Pablo R, Rebit y Rod suman",
    );
    expect(out).toContain("Si gana Aleti, Niki y Uri suman");
    expect(out).toContain("Si empatan, Chacho, Lu, Manu, Marta y Miks suman");

    // -------- Section 2: por score exacto (4 pts cada uno) --------
    expect(out).toContain(
      "Si gana PSG 2-1, Aran, De Santa, Gonza B, Kelo, Nikito, Pablo P, Pablo R, Rebit y Rod suman 4 pts",
    );
    expect(out).toContain("Si gana PSG 3-1, Diegui suma 4 pts");
    expect(out).toContain("Si empatan 1-1, Chacho, Lu y Marta suman 4 pts");
    expect(out).toContain("Si empatan 2-2, Manu y Miks suman 4 pts");
    expect(out).toContain("Si gana Aleti 1-0, Niki suma 4 pts");
    expect(out).toContain("Si gana Aleti 2-1, Uri suma 4 pts");

    // -------- Order: winner section before exact section --------
    expect(out.indexOf("Si empatan, Chacho")).toBeLessThan(
      out.indexOf("Si gana PSG 2-1"),
    );
    // -------- Order within exact section: home → draws → away --------
    const idxPSG = out.indexOf("Si gana PSG 2-1");
    const idxDraw = out.indexOf("Si empatan 1-1");
    const idxAleti = out.indexOf("Si gana Aleti 1-0");
    expect(idxPSG).toBeLessThan(idxDraw);
    expect(idxDraw).toBeLessThan(idxAleti);

    // -------- No penalty section in group stage --------
    expect(out).not.toContain("penales");
  });

  // Same data but ko=true to verify the penalty section snaps in cleanly.
  it("adds the penalty section in knockouts with pk predictions", () => {
    const PSG = { id: 100, name: "PSG", fifa_code: "ZZZ" };
    const ALETI = { id: 200, name: "Aleti", fifa_code: "YYY" };

    const predictions: SummaryPrediction[] = [
      pred(1, 1, "Chacho", PSG.id),
      pred(1, 1, "Marta", PSG.id),
      pred(1, 1, "Lu", ALETI.id),
      pred(2, 1, "Rebit"),
    ];

    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: ALETI,
      predictions,
      intro: null,
      isKnockout: true,
    });

    expect(out).toContain("Si PSG gana en penales, Chacho y Marta suman +1");
    expect(out).toContain("Si Aleti gana en penales, Lu suma +1");
  });
});
