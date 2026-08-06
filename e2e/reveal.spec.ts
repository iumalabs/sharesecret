import { expect, gotoFresh, test } from "./fixtures";
import { PIN_ATTEMPTS } from "../src/shared/constants";

test.describe("PIN entry", () => {
  test("visiting a valid link shows the PIN entry screen", async ({ page, createSecret }) => {
    const { link } = await createSecret();
    await page.goto(link);

    await expect(page.getByRole("heading", { name: "Someone left you a sealed note" })).toBeVisible();
    await expect(page.getByText("Enter the PIN they gave you on another channel.")).toBeVisible();
    const pinInput = page.getByLabel("PIN");
    await expect(pinInput).toBeFocused();
    await expect(page.getByRole("button", { name: "Reveal secret" })).toBeDisabled();
  });

  test("non-digit characters are stripped from the PIN field as you type", async ({ page, createSecret }) => {
    const { link } = await createSecret();
    await page.goto(link);

    const pinInput = page.getByLabel("PIN");
    await pinInput.pressSequentially("1a2b3");
    await expect(pinInput).toHaveValue("123");
  });

  test("submitting the correct PIN reveals the exact original message", async ({ page, createSecret }) => {
    const message = "the launch codes are 00000, rotate them within the hour";
    const { link, pin } = await createSecret(message);
    await page.goto(link);

    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();

    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();
    await expect(page.getByText("decrypted locally")).toBeVisible();
    await expect(page.locator("pre.secret-body")).toHaveText(message);
  });

  test("preserves whitespace and multi-line formatting through encrypt/decrypt", async ({ page, createSecret }) => {
    const message = "line one\nline two\n\tindented line three";
    const { link, pin } = await createSecret(message);
    await page.goto(link);

    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();

    await expect(page.locator("pre.secret-body")).toHaveText(message);
  });

  test("wrong PIN shows an error with attempts remaining, and does not consume the secret", async ({ page, createSecret }) => {
    const { link } = await createSecret();
    await page.goto(link);

    await page.getByLabel("PIN").fill("00000");
    await page.getByRole("button", { name: "Reveal secret" }).click();

    await expect(page.getByRole("alert")).toContainText(`${PIN_ATTEMPTS - 1} attempts left`);
    // PIN field clears after a rejected attempt.
    await expect(page.getByLabel("PIN")).toHaveValue("");
    // Still on the PIN screen -- the secret was not destroyed by one bad guess.
    await expect(page.getByRole("heading", { name: "Someone left you a sealed note" })).toBeVisible();
  });

  test(`destroys the secret after ${PIN_ATTEMPTS} wrong PINs, even for the correct PIN afterwards`, async ({ page, createSecret }) => {
    const { link } = await createSecret();
    await page.goto(link);

    const pinInput = page.getByLabel("PIN");
    const submit = page.getByRole("button", { name: "Reveal secret" });

    for (let attempt = 1; attempt < PIN_ATTEMPTS; attempt++) {
      await pinInput.fill("00000");
      // Under heavy parallel load the disabled->enabled re-render can lag
      // fill(); wait for it explicitly for robustness under contention.
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(page.getByRole("alert")).toContainText(`${PIN_ATTEMPTS - attempt} attempt`);
    }

    // Final wrong attempt destroys the secret outright.
    await pinInput.fill("00000");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole("heading", { name: "Secret destroyed" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(/destroyed/i);
    // GH #48: dead ends offer a way to continue besides the top nav.
    await expect(page.getByRole("link", { name: /Send a secret/ })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Open vault" })).toHaveAttribute("href", "/vault");

    // The row is gone server-side now, so re-opening the link in a fresh
    // navigation (a real recipient re-opening the link, not a same-document
    // fragment change) goes straight to "not found" -- the PIN form never
    // gets a chance to render, even with the PIN that used to be correct.
    await gotoFresh(page, link);
    await expect(page.getByRole("heading", { name: "Secret not found" })).toBeVisible();
  });

  test("one-time read: a second visit after a successful reveal shows 'not found'", async ({ page, createSecret }) => {
    const { link, pin } = await createSecret();
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await gotoFresh(page, link);
    await expect(page.getByRole("heading", { name: "Secret not found" })).toBeVisible();
    await expect(page.getByText("This secret has already been viewed, has expired, or never existed.")).toBeVisible();
  });

  test("copy content button copies the revealed plaintext to the clipboard", async ({ page, createSecret }) => {
    const message = "copy me exactly";
    const { link, pin } = await createSecret(message);
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await page.getByRole("button", { name: "Copy content" }).click();
    await expect(page.getByText("✓ Copied to clipboard")).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(message);
  });
});

test.describe("revealed-secret auto-clear", () => {
  // RevealPage clears the decrypted plaintext from screen 60s after reveal,
  // or immediately if the tab is hidden -- whichever comes first (see
  // AUTO_CLEAR_MS in RevealPage.tsx). The secret is already deleted
  // server-side by this point; this only limits client-side exposure if
  // someone reveals it and walks away with the tab open.

  test("clears the plaintext from the screen after 60 seconds", async ({ page, createSecret }) => {
    await page.clock.install();

    const message = "auto-clear timeout probe";
    const { link, pin } = await createSecret(message);
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();
    await expect(page.locator("pre.secret-body")).toHaveText(message);

    // Just under the timeout: still showing the plaintext.
    await page.clock.fastForward(59_000);
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    // Past it: cleared, and the plaintext is gone from the DOM entirely,
    // not just visually hidden.
    await page.clock.fastForward(2_000);
    await expect(page.getByRole("heading", { name: "Secret cleared" })).toBeVisible();
    await expect(page.locator("pre.secret-body")).toHaveCount(0);
    await expect(page.getByText(message)).toHaveCount(0);
    // GH #48: dead ends offer a way to continue besides the top nav.
    await expect(page.getByRole("link", { name: /Send a secret/ })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Open vault" })).toHaveAttribute("href", "/vault");
  });

  test("clears immediately when the tab becomes hidden, before the timeout", async ({ page, createSecret }) => {
    const message = "auto-clear visibility probe";
    const { link, pin } = await createSecret(message);
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expect(page.getByRole("heading", { name: "Secret cleared" })).toBeVisible();
    await expect(page.getByText("This secret was already deleted from the server after being read once")).toBeVisible();
    await expect(page.getByText(message)).toHaveCount(0);
  });
});

test.describe("revealed-secret countdown & manual burn", () => {
  // GH #47: the revealed screen auto-clears (see the describe block above)
  // but previously gave the reader no visible indication a clock was
  // running at all. These cover the countdown text/progress bar and the
  // "Burn it now" escape hatch added to close that gap.

  test("shows a live destruct countdown that ticks down", async ({ page, createSecret }) => {
    await page.clock.install();

    const { link, pin } = await createSecret("countdown probe");
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await expect(page.getByText("Destruct in 01:00")).toBeVisible();

    await page.clock.fastForward(15_000);
    await expect(page.getByText("Destruct in 00:45")).toBeVisible();
  });

  test("'Burn it now' clears the screen immediately, without waiting for the timeout", async ({ page, createSecret }) => {
    const message = "manual burn probe";
    const { link, pin } = await createSecret(message);
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await page.getByRole("button", { name: "Burn it now" }).click();

    await expect(page.getByRole("heading", { name: "Secret cleared" })).toBeVisible();
    await expect(page.getByText(message)).toHaveCount(0);
  });
});

test.describe("PIN keyboard interaction", () => {
  test("Enter key submits the PIN form", async ({ page, createSecret }) => {
    const { link, pin } = await createSecret();
    await page.goto(link);

    await page.getByLabel("PIN").fill(pin);
    await page.getByLabel("PIN").press("Enter");

    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();
  });
});
