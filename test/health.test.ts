import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("health & params", () => {
  it("responds to /api/v1/ping", async () => {
    const res = await SELF.fetch("https://example.com/api/v1/ping");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("pong");
  });

  it("exposes public config via /api/v1/params", async () => {
    const res = await SELF.fetch("https://example.com/api/v1/params");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ pinSize: expect.any(Number), maxExpireSeconds: expect.any(Number) });
  });
});
