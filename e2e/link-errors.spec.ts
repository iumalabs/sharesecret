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
      // Known bug: https://github.com/maksimyugai/sharesecret/issues/17
      // `importKey()` rejects fast and sets "missing-key", but the sibling
      // `checkMessage(id)` network call resolves slightly later and
      // unconditionally overwrites status to "ready" (since the id is real),
      // landing the recipient on a PIN form whose submit button can never be
      // enabled (`key` was never set). Reproduces on ~every run once the id
      // genuinely exists server-side, not just occasionally -- this isn't
      // flakiness in the test, it's the app's real (buggy) behavior.
      test.fail(true, "tracked by #17 -- remove test.fail() once the race in RevealPage's useEffect is fixed");

      const { id } = await createSecret();
      // "not-a-real-key" is not decodable into a usable AES key length.
      await page.goto(`/s/${id}#not-a-real-key`);

      await expect(page.getByRole("heading", { name: "Incomplete link" })).toBeVisible();
      // Give checkMessage()'s in-flight fetch time to resolve and (today)
      // clobber the status -- this is the assertion that currently fails.
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
