import { describe, expect, it } from "vitest";

import { predictionSchema, specialSchema } from "./schemas";

describe("predictionSchema", () => {
  it("accepts a valid integer prediction", () => {
    const result = predictionSchema.safeParse({
      matchId: 12,
      homeScore: 1,
      awayScore: 0,
    });
    expect(result.success).toBe(true);
  });

  it("coerces stringified numbers from form inputs", () => {
    const result = predictionSchema.safeParse({
      matchId: "42",
      homeScore: "2",
      awayScore: "3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ matchId: 42, homeScore: 2, awayScore: 3 });
    }
  });

  it("rejects negative scores", () => {
    const result = predictionSchema.safeParse({
      matchId: 1,
      homeScore: -1,
      awayScore: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects scores above 20", () => {
    const result = predictionSchema.safeParse({
      matchId: 1,
      homeScore: 21,
      awayScore: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer scores", () => {
    const result = predictionSchema.safeParse({
      matchId: 1,
      homeScore: 1.5,
      awayScore: 0,
    });
    expect(result.success).toBe(false);
  });

  it("allows optional pkWinnerTeamId", () => {
    const result = predictionSchema.safeParse({
      matchId: 1,
      homeScore: 1,
      awayScore: 1,
      pkWinnerTeamId: 7,
    });
    expect(result.success).toBe(true);
  });
});

describe("specialSchema", () => {
  it("accepts an all-null payload (user hasn't decided yet)", () => {
    const result = specialSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated payload", () => {
    const result = specialSchema.safeParse({
      championTeamId: 1,
      runnerUpTeamId: 2,
      topScorerPlayerId: 10,
      mvpPlayerId: 11,
      bestGkPlayerId: 12,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-positive IDs", () => {
    const result = specialSchema.safeParse({ championTeamId: 0 });
    expect(result.success).toBe(false);
  });
});
