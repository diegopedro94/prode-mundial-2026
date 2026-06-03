import { describe, expect, it } from "vitest";

import { buildMatchSummary, type SummaryPrediction } from "./match-summary";

const PSG = { id: 1, name: "France", fifa_code: "FRA" };
const BAY = { id: 2, name: "Germany", fifa_code: "GER" };

function pred(
  home: number,
  away: number,
  name: string,
  pk: number | null = null,
): SummaryPrediction {
  return { home_score: home, away_score: away, pk_winner_team_id: pk, display_name: name };
}

describe("buildMatchSummary", () => {
  it("renders the intro above the auto-generated sections", () => {
    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: BAY,
      predictions: [pred(2, 1, "Diego")],
      intro: "Vamos PSG che",
      isKnockout: false,
    });
    expect(out.split("\n")[0]).toBe("Vamos PSG che");
  });

  it("groups by exact score, sorted home-wins → draws → away-wins", () => {
    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: BAY,
      predictions: [
        pred(2, 1, "A"),
        pred(2, 1, "B"),
        pred(1, 1, "C"),
        pred(0, 2, "D"),
        pred(3, 1, "E"),
      ],
      intro: null,
      isKnockout: false,
    });
    const idxPSG21 = out.indexOf("Gana Francia 2-1");
    const idxPSG31 = out.indexOf("Gana Francia 3-1");
    const idxEmpate = out.indexOf("Empatan 1-1");
    const idxBay20 = out.indexOf("Gana Alemania 2-0");
    expect(idxPSG21).toBeGreaterThan(-1);
    expect(idxPSG21).toBeLessThan(idxPSG31);
    expect(idxPSG31).toBeLessThan(idxEmpate);
    expect(idxEmpate).toBeLessThan(idxBay20);
  });

  it("joins names with Spanish 'y' before the last item", () => {
    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: BAY,
      predictions: [pred(2, 1, "Ana"), pred(2, 1, "Bea"), pred(2, 1, "Caro")],
      intro: null,
      isKnockout: false,
    });
    expect(out).toContain("Ana, Bea y Caro");
  });

  it("uses 'y' (no oxford comma) for exactly two names", () => {
    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: BAY,
      predictions: [pred(1, 0, "Ana"), pred(1, 0, "Bea")],
      intro: null,
      isKnockout: false,
    });
    expect(out).toContain("Ana y Bea");
  });

  it("includes the winner section grouping everyone by predicted outcome", () => {
    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: BAY,
      predictions: [pred(2, 1, "Ana"), pred(0, 1, "Bea"), pred(1, 1, "Caro")],
      intro: null,
      isKnockout: false,
    });
    expect(out).toContain("Gana Francia: Ana");
    expect(out).toContain("Gana Alemania: Bea");
    expect(out).toContain("Empate: Caro");
  });

  it("skips the penalty section for group-stage matches", () => {
    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: BAY,
      predictions: [pred(1, 1, "Ana", PSG.id), pred(1, 1, "Bea", BAY.id)],
      intro: null,
      isKnockout: false,
    });
    expect(out).not.toContain("Bonus penales");
  });

  it("shows the penalty section for knockouts when at least one pk is predicted", () => {
    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: BAY,
      predictions: [
        pred(1, 1, "Ana", PSG.id),
        pred(1, 1, "Bea", BAY.id),
        pred(2, 0, "Caro"),
      ],
      intro: null,
      isKnockout: true,
    });
    expect(out).toContain("Bonus penales");
    expect(out).toContain("Gana Francia en penales: Ana");
    expect(out).toContain("Gana Alemania en penales: Bea");
  });

  it("handles the no-predictions edge case", () => {
    const out = buildMatchSummary({
      homeTeam: PSG,
      awayTeam: BAY,
      predictions: [],
      intro: null,
      isKnockout: false,
    });
    expect(out).toContain("Nadie cargó predicción");
  });
});
