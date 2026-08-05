import { test, expect } from "./fixtures";

// Exercises src/worker/middleware/rate-limit.ts directly against the API
// (bypassing the UI, which would be far slower for firing this many
// requests). Each test in this file gets its own synthetic CF-Connecting-IP
// via the `page` fixture override in fixtures.ts, so hammering one limiter
// here can't bleed into -- or get bled into by -- any other test's budget.
//
// Cloudflare's Rate Limiting API is documented as best-effort/approximate,
// not an atomic counter. Calibrated with standalone curl bursts: run in
// total isolation, the local limiter is exactly precise (20/40 and 10/25
// every time). Run inside the full parallel suite, sharing one dev-server
// process with every other worker's simultaneous traffic, the number of
// requests let through before throttling kicks in was observed to vary
// widely run to run (seen anywhere from 20 to 33 successes against a
// configured limit of 20) -- contention on the shared local server measurably
// affects the limiter's precision, not just the wall-clock timing. Pinning a
// specific success-count boundary chased a moving target and kept flaking.
// These assert only the property that's actually stable and meaningful: a
// burst well beyond the configured limit eventually gets throttled, and
// throttling isn't so aggressive that literally nothing gets through.

test.describe("create rate limit (RATE_LIMITER_CREATE: 20 / 60s)", () => {
  test("a burst well beyond the limit eventually gets throttled", async ({ page }) => {
    const body = { data: "aGVsbG8", pin: "12345", expireSeconds: 3600 };
    const TOTAL = 60;

    const statuses: number[] = [];
    for (let i = 0; i < TOTAL; i++) {
      statuses.push((await page.request.post("/api/v1/message", { data: body })).status());
    }

    expect(statuses.every((s) => s === 201 || s === 429)).toBe(true);
    expect(statuses.some((s) => s === 201)).toBe(true);
    expect(statuses.some((s) => s === 429)).toBe(true);
  });
});

test.describe("reveal rate limit (RATE_LIMITER_REVEAL: 10 / 60s)", () => {
  test("a burst well beyond the limit eventually gets throttled", async ({ page }) => {
    // GET /api/v1/message/:id shares the same limiter as POST .../reveal --
    // hitting the cheaper existence-check endpoint is enough to prove it.
    const TOTAL = 40;

    const statuses: number[] = [];
    for (let i = 0; i < TOTAL; i++) {
      statuses.push((await page.request.get("/api/v1/message/doesnotexist")).status());
    }

    expect(statuses.every((s) => s === 404 || s === 429)).toBe(true);
    expect(statuses.some((s) => s === 404)).toBe(true);
    expect(statuses.some((s) => s === 429)).toBe(true);
  });
});
