import { describe, expect, it } from "vitest";

import { matchResultSchema } from "./schemas";

describe("matchResultSchema", () => {
  it("accepts a scheduled match with null scores", () => {
    const r = matchResultSchema.safeParse({
      matchId: 1,
      homeScore: null,
      awayScore: null,
      wentToPenalties: false,
      pkWinnerTeamId: null,
      status: "scheduled",
      stage: "group",
    });
    expect(r.success).toBe(true);
  });

  it("rejects finished match without both scores", () => {
    const r = matchResultSchema.safeParse({
      matchId: 1,
      homeScore: 1,
      awayScore: null,
      wentToPenalties: false,
      pkWinnerTeamId: null,
      status: "finished",
      stage: "group",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a finished group-stage tie", () => {
    const r = matchResultSchema.safeParse({
      matchId: 1,
      homeScore: 1,
      awayScore: 1,
      wentToPenalties: false,
      pkWinnerTeamId: null,
      status: "finished",
      stage: "group",
    });
    expect(r.success).toBe(true);
  });

  it("rejects knockout tied without penalties", () => {
    const r = matchResultSchema.safeParse({
      matchId: 1,
      homeScore: 1,
      awayScore: 1,
      wentToPenalties: false,
      pkWinnerTeamId: null,
      status: "finished",
      stage: "qf",
    });
    expect(r.success).toBe(false);
  });

  it("accepts knockout tied with penalties + pk winner", () => {
    const r = matchResultSchema.safeParse({
      matchId: 1,
      homeScore: 1,
      awayScore: 1,
      wentToPenalties: true,
      pkWinnerTeamId: 10,
      status: "finished",
      stage: "qf",
    });
    expect(r.success).toBe(true);
  });
});
