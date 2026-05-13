import { describe, expect, it } from "vitest";

import { createApiFootballClient } from "./client";

describe("createApiFootballClient", () => {
  it("throws when API_FOOTBALL_KEY is missing", () => {
    const previous = process.env.API_FOOTBALL_KEY;
    delete process.env.API_FOOTBALL_KEY;
    expect(() => createApiFootballClient()).toThrow(/API_FOOTBALL_KEY/);
    if (previous) process.env.API_FOOTBALL_KEY = previous;
  });

  it("accepts an explicit apiKey", () => {
    const client = createApiFootballClient({ apiKey: "test" });
    expect(typeof client.listTeams).toBe("function");
    expect(typeof client.listStandings).toBe("function");
    expect(typeof client.listSquad).toBe("function");
  });
});
