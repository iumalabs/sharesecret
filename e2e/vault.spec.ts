import { expect, gotoFresh, test } from "./fixtures";

// Vault (added in #31) is a local-only, browser-side history of secrets
// created in this tab -- src/react-app/lib/vault.ts stores only
// { id, createdAt, expiresAt, revoked } in localStorage, deliberately never
// the plaintext or decryption key. Each test here gets a fresh browser
// context (Playwright default), so localStorage -- and therefore the
// Vault -- starts empty every time.

// VaultPage's Live/Read status isn't known synchronously -- it comes from a
// real GET /api/v1/message/:id round trip per entry (see the mount effect
// in VaultPage.tsx), so it starts as "Checking…" and flips once that
// resolves. The default 5s assertion timeout was observed to be too tight
// for this specific step under load (this dev server is routinely run
// alongside other tooling in this environment); everything else on the page
// is synchronous UI and doesn't need the longer budget.
const STATUS_TIMEOUT = 15_000;

test.describe("Vault: empty state", () => {
  test("shows an empty-state message and a way back to compose when nothing's been created", async ({ page }) => {
    await page.goto("/vault");
    await expect(page.getByRole("heading", { name: "Vault" })).toBeVisible();
    await expect(page.getByText("No secrets created in this browser yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Send a secret/ })).toBeVisible();
  });

  test("nav shows a bare 'Vault' with no count badge when the vault is empty", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Vault", exact: true })).toBeVisible();
  });
});

test.describe("Vault: entries", () => {
  test("a newly created secret appears in the Vault with a Live status and its id", async ({ page, createSecret }) => {
    const { id } = await createSecret();
    await page.goto("/vault");

    const row = page.locator(".vault-item", { hasText: id });
    await expect(row).toBeVisible();
    await expect(row.getByText("Live", { exact: true })).toBeVisible({ timeout: STATUS_TIMEOUT });
    await expect(row.getByText(/^Created /)).toBeVisible();
  });

  test("multiple secrets are listed newest-first, and the counts row reflects them", async ({ page, createSecret }) => {
    const first = await createSecret("vault order probe 1");
    const second = await createSecret("vault order probe 2");
    await page.goto("/vault");

    const ids = await page.locator(".vault-item-id").allTextContents();
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));

    // Both are fresh and unread -- 2 live, everything else 0.
    const counts = page.locator(".vault-counts");
    await expect(counts).toContainText("2", { timeout: STATUS_TIMEOUT });
    await expect(counts.getByText("Live")).toBeVisible();
  });

  test("nav badge shows the live count on the next page load after creating a secret", async ({ page, createSecret }) => {
    // The badge count is computed once at mount (not reactive within the
    // same page session -- see App.tsx's useState initializer), so it only
    // reflects a secret created *before* this particular load.
    await createSecret();
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Vault 1" })).toBeVisible();
  });
});

test.describe("Vault: revoke", () => {
  test("revoking a live secret updates its status and really deletes it server-side", async ({ page, createSecret }) => {
    const { id, link } = await createSecret("revoke-from-vault probe");
    await page.goto("/vault");

    const row = page.locator(".vault-item", { hasText: id });
    await expect(row.getByText("Live", { exact: true })).toBeVisible({ timeout: STATUS_TIMEOUT });

    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(row.getByText("Revoked by you")).toBeVisible();
    // Revoke is a one-shot action -- the button itself only shows for "live".
    await expect(row.getByRole("button", { name: "Revoke" })).toHaveCount(0);

    // Not just a local UI flag: the real link (with its real key) should now
    // be genuinely gone server-side, same as if it had been read or expired.
    await gotoFresh(page, link);
    await expect(page.getByRole("heading", { name: "Secret not found" })).toBeVisible();
  });

  test("a secret already read elsewhere shows as Read, not Live, and can't be revoked", async ({ page, createSecret }) => {
    const { id, link, pin } = await createSecret("read-before-vault-check probe");

    // Read it through the normal reveal flow first.
    await page.goto(link);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Reveal secret" }).click();
    await expect(page.getByRole("heading", { name: "Secret revealed" })).toBeVisible();

    await page.goto("/vault");
    const row = page.locator(".vault-item", { hasText: id });
    await expect(row.getByText("Read", { exact: true })).toBeVisible({ timeout: STATUS_TIMEOUT });
    await expect(row.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  });
});

test.describe("Vault: no 'Open' affordance (GH #42)", () => {
  // #42: VaultEntry only ever stores { id, createdAt, expiresAt, revoked }
  // (see lib/vault.ts) -- the decryption key deliberately never enters
  // localStorage, so there is no key anywhere to build a working
  // /s/:id#key link from Vault data alone, for any entry, ever. Fixed by
  // removing the "Open" affordance rather than faking a link (dead-end
  // "Incomplete link" every time) or reversing the zero-knowledge
  // guarantee by storing the key locally.
  test("no Open link renders for a live entry", async ({ page, createSecret }) => {
    const { id } = await createSecret();
    await page.goto("/vault");
    const row = page.locator(".vault-item", { hasText: id });
    await expect(row.getByText("Live", { exact: true })).toBeVisible({ timeout: STATUS_TIMEOUT });

    await expect(row.getByRole("link", { name: "Open" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Revoke" })).toBeVisible();
  });

  test("no Open link renders for a revoked entry", async ({ page, createSecret }) => {
    const { id } = await createSecret();
    await page.goto("/vault");
    const row = page.locator(".vault-item", { hasText: id });
    await expect(row.getByText("Live", { exact: true })).toBeVisible({ timeout: STATUS_TIMEOUT });
    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(row.getByText("Revoked by you")).toBeVisible();

    await expect(row.getByRole("link", { name: "Open" })).toHaveCount(0);
  });
});
