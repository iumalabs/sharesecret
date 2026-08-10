import { expect, test } from "./fixtures";

test.describe("top nav", () => {
  test("New secret is marked current on the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "New secret" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "How it works" })).not.toHaveAttribute("aria-current", "page");
  });

  test("How it works nav link navigates to /how and marks itself current", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "How it works" }).click();

    await expect(page).toHaveURL(/\/how$/);
    await expect(page.getByRole("heading", { name: "The three-step protocol" })).toBeVisible();
    await expect(page.getByRole("link", { name: "How it works" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "New secret" })).not.toHaveAttribute("aria-current", "page");
  });

  test("brand logo/wordmark links back to the home page", async ({ page }) => {
    await page.goto("/how");
    await page.getByRole("link", { name: "SHARESECRET" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Say it once\./ })).toBeVisible();
  });

  test("New secret still shows as current while viewing the sealed-result screen", async ({ page, createSecret }) => {
    await createSecret();
    await expect(page.getByRole("link", { name: "New secret" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("How It Works page", () => {
  test("lists all three protocol steps with their descriptions", async ({ page }) => {
    await page.goto("/how");

    await expect(page.getByText("01 / SEAL")).toBeVisible();
    await expect(page.getByText("Encrypted in your tab")).toBeVisible();
    await expect(page.getByText("02 / SEND")).toBeVisible();
    await expect(page.getByText("Two channels, one secret")).toBeVisible();
    await expect(page.getByText("03 / SHRED")).toBeVisible();
    await expect(page.getByText("Read, then deleted")).toBeVisible();
  });

  test("shows the threat model panel with all four guarantees", async ({ page }) => {
    await page.goto("/how");

    await expect(page.getByText("We can't read your secret. Neither can a subpoena.")).toBeVisible();
    await expect(page.getByText("Decryption key lives only in the URL fragment")).toBeVisible();
    await expect(page.getByText("No account, no email, no analytics cookie")).toBeVisible();
    await expect(page.getByText("PIN attempts limited to 3, then the blob burns")).toBeVisible();
    await expect(page.getByText("Open source protocol, reproducible builds")).toBeVisible();
  });

  test("'send a secret' CTA returns to the compose form", async ({ page }) => {
    await page.goto("/how");
    await page.getByRole("link", { name: /Send a secret/ }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Say it once\./ })).toBeVisible();
  });
});

test.describe("footer", () => {
  test("is present with a link to the source repo", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "Source" })).toHaveAttribute(
      "href",
      "https://github.com/iumalabs/sharesecret",
    );
    await expect(footer.getByRole("link", { name: "Protocol" })).toHaveAttribute("href", "/how");
  });
});

test.describe("unknown routes", () => {
  test("an unrecognized path falls back to the compose home page (SPA default route)", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("heading", { name: /Say it once\./ })).toBeVisible();
  });
});
