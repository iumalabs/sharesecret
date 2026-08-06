import { expect, test } from "./fixtures";
import { PIN_ATTEMPTS } from "../src/shared/constants";

// Both groups below started out as regression traps for real gaps between
// the design mockup (docs/sharesecret-design.zip -- ShareSecret.dc.html) and
// RevealPage.tsx, filed as #47 and #48. Both landed (#47 via PR #50, #48 via
// StatusPageActions in RevealPage.tsx) while this file was in progress, so
// both groups are now plain, currently-passing assertions of the shipped UI.

test.describe("Revealed-secret screen shows a destruct countdown and manual burn (GH #47)", () => {
  test("shows a live 'destruct in' countdown once revealed", async ({ page, createSecret }) => {
    const { link, pin } = await createSecret();
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await expect(page.getByText(/destruct in/i)).toBeVisible();
  });

  test("offers a manual 'burn it now' action instead of only waiting out the timer", async ({ page, createSecret }) => {
    const { link, pin } = await createSecret();
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    const burnButton = page.getByRole("button", { name: /burn it now/i });
    await expect(burnButton).toBeVisible();
    await burnButton.click();
    await expect(page.getByRole("heading", { name: "Secret cleared" })).toBeVisible();
  });

  test("warns the reader to copy the secret before the timer ends", async ({ page, createSecret }) => {
    const { link, pin } = await createSecret();
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await expect(page.getByText(/before the timer ends/i)).toBeVisible();
  });
});

test.describe("Dead-end reveal screens offer a way back into the app (GH #48)", () => {
  // Design's equivalent "gone" screen always pairs the dead-end message with
  // "SEND ONE BACK" / "OPEN VAULT" buttons. RevealPage.tsx's three terminal
  // states now render the same pair via StatusPageActions.

  test("'Secret not found' offers a way to send a secret or open the vault", async ({ page }) => {
    // Same well-formed-but-unknown link used in link-errors.spec.ts.
    await page.goto("/s/doesnotexist12#AAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByRole("heading", { name: "Secret not found" })).toBeVisible();

    await expect(page.getByRole("main").getByRole("link", { name: /send a secret/i })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /vault/i })).toBeVisible();
  });

  test("'Secret destroyed' (after exhausting wrong PINs) offers a way to send a secret or open the vault", async ({ page, createSecret }) => {
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
