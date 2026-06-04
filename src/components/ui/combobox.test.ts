import { describe, expect, it } from "vitest";

import { substringFilter } from "./combobox";

describe("substringFilter", () => {
  it("matches by surname when value uses initial+lastname format", () => {
    expect(substringFilter("T. Payne", "Payne")).toBe(1);
    expect(substringFilter("T. Payne", "payne")).toBe(1);
  });

  it("matches by first name via keywords (api-football short names)", () => {
    // "T. Payne" stored with firstname keyword "Tim" — searching "Tim" should hit.
    expect(substringFilter("T. Payne", "Tim", ["Timothy John", "Payne"])).toBe(1);
    expect(substringFilter("T. Payne", "Timothy", ["Timothy John", "Payne"])).toBe(1);
  });

  it("ignores diacritics", () => {
    expect(substringFilter("Lautaro Martínez", "martinez")).toBe(1);
    expect(substringFilter("Lautaro Martínez", "Martinez")).toBe(1);
  });

  it("ignores punctuation", () => {
    expect(substringFilter("T. Payne", "t payne")).toBe(1);
  });

  it("supports out-of-order tokens (each token must appear)", () => {
    expect(
      substringFilter("L. Messi", "argentina messi", ["Lionel", "Messi", "Argentina", "ARG"]),
    ).toBe(1);
    expect(
      substringFilter("L. Messi", "messi argentina", ["Lionel", "Messi", "Argentina", "ARG"]),
    ).toBe(1);
  });

  it("returns 0 when at least one token has no match", () => {
    expect(substringFilter("T. Payne", "tim wrongteam", ["Tim", "Payne"])).toBe(0);
  });

  it("returns 1 (visible) for an empty search", () => {
    expect(substringFilter("T. Payne", "")).toBe(1);
    expect(substringFilter("T. Payne", "   ")).toBe(1);
  });
});
