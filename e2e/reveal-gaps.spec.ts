import { expect, test } from "./fixtures";
import { PIN_ATTEMPTS } from "../src/shared/constants";

// Both groups below document real gaps between the design mockup
// (docs/sharesecret-design.zip -- ShareSecret.dc.html) and RevealPage.tsx,
// filed as #47 and #48. Nothing here is fixed yet, so every assertion is
// wrapped in test.fail() as a regression trap: each test documents a
// currently-missing element and will start failing "unexpectedly" (in a
// good way) the moment that element ships, which is the signal to drop the
// test.fail() wrapper and turn it into a normal assertion.

test.describe("Revealed-secret screen is missing the design's destruct-countdown UI (GH #47)", () => {
  test("shows a live 'destruct in' countdown once revealed", async ({ page, createSecret }) => {
    test.fail(
      true,
      "tracked by #47 -- the 60s auto-clear (AUTO_CLEAR_MS) is a silent setTimeout, no on-screen countdown exists",
    );

    const { link, pin } = await createSecret();
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await expect(page.getByText(/destruct in/i)).toBeVisible();
  });

  test("offers a manual 'burn it now' action instead of only waiting out the timer", async ({ page, createSecret }) => {
    test.fail(true, "tracked by #47 -- only a 'Copy content' button exists, no way to clear the screen early");

    const { link, pin } = await createSecret();
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await expect(page.getByRole("button", { name: /burn it now/i })).toBeVisible();
  });

  test("warns the reader to copy the secret before the timer ends", async ({ page, createSecret }) => {
    test.fail(
      true,
      "tracked by #47 -- current copy only explains the secret can't be viewed again, not that a live timer is running",
    );

    const { link, pin } = await createSecret();
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await expect(page.getByText(/before the timer ends/i)).toBeVisible();
  });
});

test.describe("Dead-end reveal screens offer no way back into the app (GH #48)", () => {
  // Design's equivalent "gone" screen always pairs the dead-end message with
  // "SEND ONE BACK" / "OPEN VAULT" buttons. RevealPage.tsx's three terminal
  // states below render only a status icon, heading, and paragraph -- no
  // links anywhere except the persistent top nav.

  test("'Secret not found' offers a way to send a secret or open the vault", async ({ page }) => {
    test.fail(true, "tracked by #48 -- not-found/destroyed/cleared have no forward-navigation links in the page body");

    // Same well-formed-but-unknown link used in link-errors.spec.ts.
    await page.goto("/s/doesnotexist12#AAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByRole("heading", { name: "Secret not found" })).toBeVisible();

    await expect(page.getByRole("main").getByRole("link", { name: /send a secret/i })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /vault/i })).toBeVisible();
  });

  test("'Secret destroyed' (after exhausting wrong PINs) offers a way to send a secret or open the vault", async ({ page, createSecret }) => {
    test.fail(true, "tracked by #48");

    const { link } = await createSecret();
    await page.goto(link);
    const pinInput = page.getByLabel("PIN");
    const submit = page.getByRole("button", { name: "Reveal secret" });

    for (let attempt = 1; attempt < PIN_ATTEMPTS; attempt++) {
      await pinInput.fill("00000");
      await expect(submit).toBeEnabled();
      await submit.click();
      // Wait for the rejected-attempt state to fully settle (including the
      // PIN field's own clear-on-reject) before typing the next attempt --
      // otherwise a same-value refill can race React's re-render and get
      // silently wiped back to empty, wedging the button disabled forever.
      // Mirrors the loop in reveal.spec.ts's "destroys the secret after N
      // wrong PINs" test.
      await expect(page.getByRole("alert")).toContainText(`${PIN_ATTEMPTS - attempt} attempt`);
    }

    // Final wrong attempt destroys the secret outright.
    await pinInput.fill("00000");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole("heading", { name: "Secret destroyed" })).toBeVisible();

    await expect(page.getByRole("main").getByRole("link", { name: /send a secret/i })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /vault/i })).toBeVisible();
  });

  test("'Secret cleared' (after auto-clear) offers a way to send a secret or open the vault", async ({ page, createSecret }) => {
    test.fail(true, "tracked by #48");

    const { link, pin } = await createSecret();
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByRole("heading", { name: "Secret cleared" })).toBeVisible();

    await expect(page.getByRole("main").getByRole("link", { name: /send a secret/i })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /vault/i })).toBeVisible();
  });
});
