import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BASE = "https://example.com/api/v1";

function createMessage(overrides: Partial<{ data: string; pin: string; expireSeconds: number }> = {}) {
  return SELF.fetch(`${BASE}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: "aGVsbG8", pin: "12345", expireSeconds: 3600, ...overrides }),
  });
}

function reveal(id: string, pin: string) {
  return SELF.fetch(`${BASE}/message/${id}/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
}

describe("secret create + reveal", () => {
  it("round-trips a message through create and reveal", async () => {
    const createRes = await createMessage();
    expect(createRes.status).toBe(201);
    const { id } = await createRes.json<{ id: string }>();

    const existsRes = await SELF.fetch(`${BASE}/message/${id}`);
    expect(existsRes.status).toBe(200);

    const revealRes = await reveal(id, "12345");
    expect(revealRes.status).toBe(200);
    const { data } = await revealRes.json<{ data: string }>();
    expect(data).toBe("aGVsbG8");
  });

  it("is one-time: a second reveal after a successful read returns 404", async () => {
    const { id } = await (await createMessage()).json<{ id: string }>();
    await reveal(id, "12345");

    const second = await reveal(id, "12345");
    expect(second.status).toBe(404);
  });

  it("destroys the message after PIN_ATTEMPTS wrong PINs", async () => {
    const { id } = await (await createMessage()).json<{ id: string }>();

    const first = await reveal(id, "00000");
    expect(first.status).toBe(403);
    expect((await first.json<{ attemptsRemaining: number }>()).attemptsRemaining).toBe(2);

    const second = await reveal(id, "00000");
    expect(second.status).toBe(403);

    const third = await reveal(id, "00000");
    expect(third.status).toBe(403);
    expect(await third.json<{ error: string }>()).toMatchObject({ error: expect.stringContaining("destroyed") });

    // message is gone even with the correct PIN now
    const afterDestroyed = await reveal(id, "12345");
    expect(afterDestroyed.status).toBe(404);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await reveal("doesnotexist", "12345");
    expect(res.status).toBe(404);
  });
});

describe("create validation", () => {
  it("rejects a malformed PIN", async () => {
    const res = await createMessage({ pin: "12" });
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range expiry", async () => {
    const res = await createMessage({ expireSeconds: 10 });
    expect(res.status).toBe(400);
  });

  it("rejects missing data", async () => {
    const res = await createMessage({ data: "" });
    expect(res.status).toBe(400);
  });
});

describe("security headers", () => {
  it("are present on every response", async () => {
    const res = await SELF.fetch(`${BASE}/ping`);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });
});
