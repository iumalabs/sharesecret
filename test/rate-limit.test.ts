import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BASE = "https://example.com/api/v1";

// Each test uses its own synthetic CF-Connecting-IP so the two describe
// blocks (and any other test file's traffic) can't share a rate-limit
// bucket -- see the same pattern in e2e/fixtures.ts.
function headersFor(ip: string) {
  return { "Content-Type": "application/json", "CF-Connecting-IP": ip };
}

describe("create rate limit (RATE_LIMITER_CREATE: 20 / 60s)", () => {
  it("allows the configured limit, then rejects with 429", async () => {
    const headers = headersFor("10.1.1.1");
    const body = JSON.stringify({ data: "aGVsbG8", pin: "12345", expireSeconds: 3600 });

    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await SELF.fetch(`${BASE}/message`, { method: "POST", headers, body });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 20).every((s) => s === 201)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe("reveal rate limit (RATE_LIMITER_REVEAL: 10 / 60s)", () => {
  it("allows the configured limit, then rejects with 429", async () => {
    const headers = headersFor("10.2.2.2");

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await SELF.fetch(`${BASE}/message/doesnotexist`, { headers });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
