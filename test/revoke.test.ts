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

describe("revoke", () => {
  it("deletes an unread message and it becomes unreadable", async () => {
    const { id } = await (await createMessage()).json<{ id: string }>();

    const del = await SELF.fetch(`${BASE}/message/${id}`, { method: "DELETE" });
    expect(del.status).toBe(204);

    const revealRes = await reveal(id, "12345");
    expect(revealRes.status).toBe(404);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await SELF.fetch(`${BASE}/message/doesnotexist`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("returns 404 on a second delete of the same id", async () => {
    const { id } = await (await createMessage()).json<{ id: string }>();

    await SELF.fetch(`${BASE}/message/${id}`, { method: "DELETE" });
    const second = await SELF.fetch(`${BASE}/message/${id}`, { method: "DELETE" });
    expect(second.status).toBe(404);
  });
});
