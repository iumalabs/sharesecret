import { expect, test } from "./fixtures";

// Runs only under the "mobile" Playwright project (Pixel 7 viewport/UA), see
// playwright.config.ts. Smoke-checks that the key screens render usably at
// a phone width rather than re-asserting every desktop assertion again.

test.describe("mobile viewport", () => {
  test("compose form is usable and the submit button stays on-screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Say it once\./ })).toBeVisible();

    const textarea = page.getByPlaceholder("Type the thing you shouldn't send over chat…");
    await textarea.fill("mobile secret");
    const submit = page.getByRole("button", { name: "Encrypt & get link" });
    await expect(submit).toBeInViewport();
    await submit.click();

    await expect(page.getByRole("heading", { name: "Your secret is now a stranger to us." })).toBeVisible();
  });

  test("nav collapses sensibly and both links stay reachable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "New secret" })).toBeVisible();
    await expect(page.getByRole("link", { name: "How it works" })).toBeVisible();

    await page.getByRole("link", { name: "How it works" }).click();
    await expect(page.getByRole("heading", { name: "The three-step protocol" })).toBeVisible();
  });

  test("full create -> reveal round trip works on a phone-sized viewport", async ({ page, createSecret }) => {
    const message = "mobile round trip";
    const { link, pin } = await createSecret(message);

    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();

    await expect(page.locator("pre.secret-body")).toHaveText(message);
  });
});
