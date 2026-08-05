import { test, expect } from "./fixtures";

// Expiry-based destruction (TTL elapses) is covered by the Vitest API suite
// (test/api.test.ts), which can fake wall-clock time against the Worker
// directly -- doing that through a real browser here would mean an actual
// 60s+ sleep (MIN_EXPIRE_SECONDS), so it's intentionally out of scope for e2e.

test.describe("broken / incomplete links", () => {
  test("a link with no #key fragment shows 'incomplete link'", async ({ page, createSecret }) => {
    const { id } = await createSecret();
    await page.goto(`/s/${id}`); // no hash at all

    await expect(page.getByRole("heading", { name: "Incomplete link" })).toBeVisible();
    await expect(page.getByText(/missing its decryption key/i)).toBeVisible();
  });

  test("a well-formed but unknown id shows 'secret not found'", async ({ page }) => {
    await page.goto("/s/doesnotexist12#AAAAAAAAAAAAAAAAAAAAAA");

    await expect(page.getByRole("heading", { name: "Secret not found" })).toBeVisible();
    await expect(page.getByText("This secret has already been viewed, has expired, or never existed.")).toBeVisible();
  });

  test(
    "a syntactically invalid key (wrong length/charset) stays on 'incomplete link' " +
      "instead of racing into a dead-end PIN screen",
    async ({ page, createSecret }) => {
      // Regression test for https://github.com/maksimyugai/sharesecret/issues/17
      // (fixed by #19): `importKey()` used to reject fast and set
      // "missing-key", while the sibling `checkMessage(id)` network call
      // resolved slightly later and unconditionally overwrote status to
      // "ready", landing the recipient on a dead-end PIN form. Was previously
      // marked test.fail() while the bug was open; now a plain assertion.
      const { id } = await createSecret();
      // "not-a-real-key" is not decodable into a usable AES key length.
      await page.goto(`/s/${id}#not-a-real-key`);

      await expect(page.getByRole("heading", { name: "Incomplete link" })).toBeVisible();
      // Give checkMessage()'s in-flight fetch plenty of time to resolve and
      // confirm it no longer clobbers the status.
      await page.waitForTimeout(1500);
      await expect(page.getByRole("heading", { name: "Incomplete link" })).toBeVisible();
    },
  );

  test("visiting the bare root of a secret's id twice does not leak whether the id exists without a key", async ({
    page,
    createSecret,
  }) => {
    const { id } = await createSecret();
    // Without the key fragment, the UI should short-circuit before ever
    // asking the server whether `id` exists -- both a real id and a fake
    // one should render identically ("incomplete link"), not "not found".
    await page.goto(`/s/${id}`);
    await expect(page.getByRole("heading", { name: "Incomplete link" })).toBeVisible();

    await page.goto("/s/totallymadeupid");
    await expect(page.getByRole("heading", { name: "Incomplete link" })).toBeVisible();
  });
});
