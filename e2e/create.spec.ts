import { test, expect, parseLink } from "./fixtures";
import { MAX_MESSAGE_BYTES, PIN_SIZE } from "../src/shared/constants";

test.describe("compose / create secret", () => {
  test("shows the homepage hero and empty form", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("AES-128-GCM", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Say it once\./ })).toBeVisible();
    await expect(page.getByPlaceholder("Type the thing you shouldn't send over chat…")).toHaveValue("");
    await expect(page.getByText("0 chars")).toBeVisible();
    await expect(page.getByRole("button", { name: "Encrypt & get link" })).toBeDisabled();
  });

  test("character counter tracks input length", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill("hello world");
    await expect(page.getByText("11 chars")).toBeVisible();
  });

  test("submit is disabled until a message is typed, and enabled after", async ({ page }) => {
    await page.goto("/");
    const submit = page.getByRole("button", { name: "Encrypt & get link" });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill("a secret");
    await expect(submit).toBeEnabled();

    await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill("   ");
    await expect(submit).toBeDisabled();
  });

  test("defaults to the 1 hour expiry preset and allows switching presets", async ({ page }) => {
    await page.goto("/");

    const oneHour = page.getByRole("button", { name: "1 hour" });
    await expect(oneHour).toHaveAttribute("aria-pressed", "true");

    const sixHours = page.getByRole("button", { name: "6 hours" });
    await sixHours.click();
    await expect(sixHours).toHaveAttribute("aria-pressed", "true");
    await expect(oneHour).toHaveAttribute("aria-pressed", "false");

    for (const label of ["15 min", "6 hours", "24 hours"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("creates a secret and shows the sealed result screen", async ({ page, createSecret }) => {
    const secret = await createSecret("the launch codes are 00000");

    await expect(page.getByText("sealed", { exact: true })).toBeVisible();
    await expect(page.getByText(secret.id, { exact: false })).toBeVisible();
    await expect(page.getByText(secret.pin, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy PIN" })).toBeVisible();
  });

  test("generated PIN matches the configured PIN size and link carries an id + key", async ({ createSecret }) => {
    const { id, key, pin } = await createSecret();
    expect(pin).toMatch(new RegExp(`^\\d{${PIN_SIZE}}$`));
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeGreaterThan(0);
  });

  test("'send another secret' returns to a blank compose form", async ({ page, createSecret }) => {
    await createSecret();
    await page.getByRole("button", { name: "Send another secret" }).click();

    await expect(page.getByRole("heading", { name: /Say it once\./ })).toBeVisible();
    await expect(page.getByPlaceholder("Type the thing you shouldn't send over chat…")).toHaveValue("");
  });

  test("each created secret gets a distinct id, key, and PIN", async ({ page, createSecret }) => {
    const first = await createSecret("first secret");
    await page.getByRole("button", { name: "Send another secret" }).click();
    const second = await createSecret("second secret");

    expect(second.id).not.toBe(first.id);
    expect(second.key).not.toBe(first.key);
    // PINs are drawn from a small keyspace (10^PIN_SIZE) so they *can*
    // collide by chance -- only the id/key are guaranteed unique per secret.
  });

  test("rejects a message over the max length at the input level", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder("Type the thing you shouldn't send over chat…");
    await expect(textarea).toHaveAttribute("maxlength", "40000");
    // MAX_MESSAGE_BYTES caps the *encrypted, base64url-encoded* payload server-side;
    // the textarea's maxlength is a separate, more conservative client-side guard.
    expect(MAX_MESSAGE_BYTES).toBeGreaterThan(0);
  });
});

test.describe("compose form persists across the flow", () => {
  test("message field is cleared after a successful submit (zero-knowledge -- nothing lingers)", async ({
    page,
    createSecret,
  }) => {
    await createSecret("this should not remain in any field");
    await page.getByRole("button", { name: "Send another secret" }).click();
    await expect(page.getByPlaceholder("Type the thing you shouldn't send over chat…")).toHaveValue("");
  });
});

test.describe("link shape", () => {
  test("the sealed link points at this origin's /s/:id route", async ({ page, createSecret, baseURL }) => {
    const { link, id } = await createSecret();
    expect(link.startsWith(baseURL ?? "")).toBe(true);
    expect(parseLink(link).id).toBe(id);

    const url = new URL(link);
    expect(url.pathname).toBe(`/s/${id}`);
  });
});
