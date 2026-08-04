import { describe, expect, it } from "vitest";
import { generateId } from "../src/worker/lib/id";

describe("generateId", () => {
  it("produces ids of the requested length using only the expected alphabet", () => {
    const id = generateId(12);
    expect(id).toHaveLength(12);
    expect(id).toMatch(/^[0-9A-Za-z]{12}$/);
  });

  it("produces distinct ids across calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId(12)));
    expect(ids.size).toBe(200);
  });
});
