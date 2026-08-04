import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { D1Store } from "../src/worker/lib/store";
import worker from "../src/worker/index";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

describe("scheduled cleanup", () => {
  it("purges expired messages but leaves live ones alone", async () => {
    const store = new D1Store(env.DB);
    await store.save({
      id: "expired-one",
      exp: nowSeconds() - 3600,
      data: new Uint8Array([1]),
      pinHash: "x",
      errors: 0,
    });
    await store.save({
      id: "still-alive",
      exp: nowSeconds() + 3600,
      data: new Uint8Array([2]),
      pinHash: "x",
      errors: 0,
    });

    // @ts-expect-error -- minimal fake, the handler only needs env
    await worker.scheduled?.({}, env, { waitUntil() {} });

    const alive = await env.DB.prepare("SELECT id FROM messages").all();
    expect(alive.results.map((r) => r.id)).toEqual(["still-alive"]);
  });
});
