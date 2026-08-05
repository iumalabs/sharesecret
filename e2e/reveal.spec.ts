import { test, expect, gotoFresh } from "./fixtures";
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

  test("wrong PIN shows an error with attempts remaining, and does not consume the secret", async ({
    page,
    createSecret,
  }) => {
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

  test(`destroys the secret after ${PIN_ATTEMPTS} wrong PINs, even for the correct PIN afterwards`, async ({
    page,
    createSecret,
  }) => {
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

test.describe("PIN keyboard interaction", () => {
  test("Enter key submits the PIN form", async ({ page, createSecret }) => {
    const { link, pin } = await createSecret();
    await page.goto(link);

    await page.getByLabel("PIN").fill(pin);
    await page.getByLabel("PIN").press("Enter");

    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();
  });
});
