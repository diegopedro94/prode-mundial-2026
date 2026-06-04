import { describe, expect, it } from "vitest";

import { substringFilter } from "./combobox";

describe("substringFilter", () => {
  it("matches by surname when value uses initial+lastname format", () => {
    expect(substringFilter("T. Payne", "Payne")).toBe(1);
    expect(substringFilter("T. Payne", "payne")).toBe(1);
  });

  it("ignores diacritics", () => {
    expect(substringFilter("Lautaro Martínez", "martinez")).toBe(1);
    expect(substringFilter("Lautaro Martínez", "Martinez")).toBe(1);
  });

  it("ignores punctuation", () => {
    expect(substringFilter("T. Payne", "t payne")).toBe(1);
  });

  it("supports out-of-order tokens (each token must appear in value+keywords)", () => {
    expect(substringFilter("L. Messi ARG FWD", "messi arg")).toBe(1);
    expect(substringFilter("L. Messi ARG FWD", "arg messi")).toBe(1);
    expect(substringFilter("L. Messi ARG FWD", "fwd messi")).toBe(1);
  });

  it("returns 0 when at least one token has no match", () => {
    expect(substringFilter("T. Payne ZEA DEF", "payne brasil")).toBe(0);
  });

  it("returns 1 (visible) for an empty search", () => {
    expect(substringFilter("T. Payne", "")).toBe(1);
    expect(substringFilter("T. Payne", "   ")).toBe(1);
  });
});
