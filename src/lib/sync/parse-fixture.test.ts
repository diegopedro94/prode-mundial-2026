import { describe, expect, it } from "vitest";

import {
  hasApiErrors,
  parseApiFixture,
  type ApiFixturePayload,
} from "./parse-fixture";

const HOME_INTERNAL = 100;
const AWAY_INTERNAL = 200;

function fixture(partial: Partial<ApiFixturePayload>): ApiFixturePayload {
  return {
    fixture: { id: 1, status: { short: "NS" } },
    teams: { home: { id: 10, winner: null }, away: { id: 20, winner: null } },
    goals: { home: null, away: null },
    score: {
      fulltime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
    ...partial,
  } as ApiFixturePayload;
}

describe("parseApiFixture", () => {
  // ------------ Status mapping ------------
  it("maps NS to scheduled", () => {
    const r = parseApiFixture(fixture({}), HOME_INTERNAL, AWAY_INTERNAL);
    expect(r.kind).toBe("update");
    if (r.kind === "update") expect(r.update.status).toBe("scheduled");
  });

  it("maps live states (1H, HT, 2H, ET, P) to 'live'", () => {
    for (const s of ["1H", "HT", "2H", "ET", "P"]) {
      const r = parseApiFixture(
        fixture({ fixture: { id: 1, status: { short: s } } }),
        HOME_INTERNAL,
        AWAY_INTERNAL,
      );
      expect(r.kind, `status ${s}`).toBe("update");
      if (r.kind === "update")
        expect(r.update.status, `status ${s}`).toBe("live");
    }
  });

  it("maps FT/AET/PEN to 'finished'", () => {
    for (const s of ["FT", "AET", "PEN"]) {
      const r = parseApiFixture(
        fixture({
          fixture: { id: 1, status: { short: s } },
          goals: { home: 1, away: 0 },
          teams: {
            home: { id: 10, winner: true },
            away: { id: 20, winner: false },
          },
        }),
        HOME_INTERNAL,
        AWAY_INTERNAL,
      );
      expect(r.kind, `status ${s}`).toBe("update");
      if (r.kind === "update")
        expect(r.update.status, `status ${s}`).toBe("finished");
    }
  });

  it("skips updates when the api-football status is unrecognized", () => {
    const r = parseApiFixture(
      fixture({ fixture: { id: 1, status: { short: "WUT" } } }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    expect(r.kind).toBe("skip");
    if (r.kind === "skip") expect(r.reason).toMatch(/unknown.*WUT/i);
  });

  // ------------ Score resolution ------------
  it("uses goals (end-of-play) for AET, not fulltime — regresses the BEL-SEN bug", () => {
    // Real BEL-SEN scenario: 2-2 in regulation, 3-2 after extra time.
    // Older code preferred fulltime, which dropped the extra-time goals.
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "AET" } },
        goals: { home: 3, away: 2 },
        score: {
          fulltime: { home: 2, away: 2 },
          penalty: { home: null, away: null },
        },
        teams: {
          home: { id: 10, winner: true },
          away: { id: 20, winner: false },
        },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    expect(r.kind).toBe("update");
    if (r.kind === "update") {
      expect(r.update.home_score).toBe(3);
      expect(r.update.away_score).toBe(2);
    }
  });

  it("uses fulltime (regulation only) for PEN — shootout doesn't go on the score line", () => {
    // GER-PAR scenario: 1-1 in regulation, Paraguay wins on penalties.
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "PEN" } },
        goals: { home: 1, away: 1 },
        score: {
          fulltime: { home: 1, away: 1 },
          penalty: { home: 3, away: 5 },
        },
        teams: {
          home: { id: 10, winner: false },
          away: { id: 20, winner: true },
        },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    expect(r.kind).toBe("update");
    if (r.kind === "update") {
      expect(r.update.home_score).toBe(1);
      expect(r.update.away_score).toBe(1);
      expect(r.update.went_to_penalties).toBe(true);
      expect(r.update.pk_winner_team_id).toBe(AWAY_INTERNAL);
    }
  });

  it("falls back to goals.home/away when fulltime is null", () => {
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "1H" } },
        goals: { home: 1, away: 0 },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    if (r.kind === "update") {
      expect(r.update.home_score).toBe(1);
      expect(r.update.away_score).toBe(0);
    }
  });

  it("skips finished matches with null scores instead of overwriting", () => {
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "FT" } },
        goals: { home: null, away: null },
        score: {
          fulltime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    expect(r.kind).toBe("skip");
    if (r.kind === "skip") expect(r.reason).toMatch(/missing scores/i);
  });

  // ------------ Winner derivation ------------
  it("uses teams.home.winner=true to set winner_team_id", () => {
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "FT" } },
        goals: { home: 2, away: 1 },
        teams: {
          home: { id: 10, winner: true },
          away: { id: 20, winner: false },
        },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    if (r.kind === "update") expect(r.update.winner_team_id).toBe(HOME_INTERNAL);
  });

  it("falls back to score comparison when teams.winner is null", () => {
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "FT" } },
        goals: { home: 0, away: 2 },
        teams: {
          home: { id: 10, winner: null },
          away: { id: 20, winner: null },
        },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    if (r.kind === "update") expect(r.update.winner_team_id).toBe(AWAY_INTERNAL);
  });

  it("leaves winner_team_id null on a group-stage draw", () => {
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "FT" } },
        goals: { home: 1, away: 1 },
        teams: {
          home: { id: 10, winner: false },
          away: { id: 20, winner: false },
        },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    if (r.kind === "update") expect(r.update.winner_team_id).toBeNull();
  });

  // ------------ Penalty winner ------------
  it("marks went_to_penalties=true only on PEN status", () => {
    const ft = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "FT" } },
        goals: { home: 2, away: 1 },
        teams: {
          home: { id: 10, winner: true },
          away: { id: 20, winner: false },
        },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    const pen = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "PEN" } },
        goals: { home: 1, away: 1 },
        score: {
          fulltime: { home: 1, away: 1 },
          penalty: { home: 5, away: 4 },
        },
        teams: {
          home: { id: 10, winner: true },
          away: { id: 20, winner: false },
        },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    if (ft.kind === "update") expect(ft.update.went_to_penalties).toBe(false);
    if (pen.kind === "update") expect(pen.update.went_to_penalties).toBe(true);
  });

  it("sets pk_winner from penalty score when both are present", () => {
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "PEN" } },
        goals: { home: 1, away: 1 },
        score: {
          fulltime: { home: 1, away: 1 },
          penalty: { home: 3, away: 5 },
        },
        teams: { home: { id: 10, winner: false }, away: { id: 20, winner: true } },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    if (r.kind === "update") {
      expect(r.update.pk_winner_team_id).toBe(AWAY_INTERNAL);
      expect(r.update.winner_team_id).toBe(AWAY_INTERNAL);
    }
  });

  it("leaves pk_winner null when PEN status but shootout score not published yet", () => {
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "PEN" } },
        goals: { home: 1, away: 1 },
        score: {
          fulltime: { home: 1, away: 1 },
          penalty: { home: null, away: null },
        },
        teams: { home: { id: 10, winner: null }, away: { id: 20, winner: null } },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    if (r.kind === "update") {
      expect(r.update.went_to_penalties).toBe(true);
      expect(r.update.pk_winner_team_id).toBeNull();
    }
  });

  it("leaves pk_winner null when penalty score is tied (impossible but defensive)", () => {
    const r = parseApiFixture(
      fixture({
        fixture: { id: 1, status: { short: "PEN" } },
        goals: { home: 1, away: 1 },
        score: {
          fulltime: { home: 1, away: 1 },
          penalty: { home: 4, away: 4 },
        },
        teams: { home: { id: 10, winner: null }, away: { id: 20, winner: null } },
      }),
      HOME_INTERNAL,
      AWAY_INTERNAL,
    );
    if (r.kind === "update") expect(r.update.pk_winner_team_id).toBeNull();
  });
});

describe("hasApiErrors", () => {
  it("returns false for missing or null errors", () => {
    expect(hasApiErrors({})).toBe(false);
    expect(hasApiErrors({ errors: null })).toBe(false);
  });

  it("returns false for an empty array", () => {
    expect(hasApiErrors({ errors: [] })).toBe(false);
  });

  it("returns true for a non-empty array of error strings", () => {
    expect(hasApiErrors({ errors: ["rate limit"] })).toBe(true);
  });

  it("returns false for an empty object", () => {
    expect(hasApiErrors({ errors: {} })).toBe(false);
  });

  it("returns true for an object with plan / token errors (the real shape)", () => {
    expect(
      hasApiErrors({
        errors: { plan: "Free plans do not have access to this season" },
      }),
    ).toBe(true);
    expect(hasApiErrors({ errors: { token: "invalid" } })).toBe(true);
  });
});
