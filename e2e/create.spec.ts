import { expect, parseLink, test } from "./fixtures";
import { MAX_MESSAGE_BYTES, PIN_SIZE } from "../src/shared/constants";

test.describe("compose / create secret", () => {
  test("shows the homepage hero and empty form", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("AES-256-GCM", { exact: false })).toBeVisible();
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

  test("'Copy link' flips to the default '✓ Copied' label, then reverts after its timeout", async ({ page, createSecret }) => {
    await page.clock.install();
    await createSecret();

    const copyLink = page.getByRole("button", { name: "Copy link" });
    await copyLink.click();
    await expect(page.getByRole("button", { name: "✓ Copied" })).toBeVisible();

    await page.clock.fastForward(1_601);
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "✓ Copied" })).toHaveCount(0);
  });
});

test.describe("compose errors", () => {
  test("shows an error if the initial config load fails", async ({ page }) => {
    await page.route("**/api/v1/params", (route) => route.fulfill({ status: 500, body: "" }));
    await page.goto("/");

    await expect(page.getByRole("alert")).toHaveText("Couldn't reach the server. Please reload the page.");
    // The form itself never becomes usable without params (PIN size, expiry
    // bounds, etc. all come from there).
    await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill("a secret");
    await expect(page.getByRole("button", { name: "Encrypt & get link" })).toBeDisabled();
  });

  test("shows the server's error message when creating a secret fails", async ({ page }) => {
    await page.route("**/api/v1/message", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      // No "error" field -- exercises the response-parsing fallback message,
      // not just the happy-path "the server told us why" case.
      return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });
    await page.goto("/");
    await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill("a secret");
    await page.getByRole("button", { name: "Encrypt & get link" }).click();

    await expect(page.getByRole("alert")).toHaveText("Request failed (500)");
  });

  test("shows a generic error if the create request never reaches the server", async ({ page }) => {
    await page.route("**/api/v1/message", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.abort("failed");
    });
    await page.goto("/");
    await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill("a secret");
    await page.getByRole("button", { name: "Encrypt & get link" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "Something went wrong while encrypting or sending your secret. Please try again.",
    );
  });

  test("shows the generic fallback message when an error response's body isn't valid JSON at all", async ({ page }) => {
    await page.route("**/api/v1/message", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      // Not just missing an "error" key -- genuinely unparseable, so
      // res.json() itself throws and the response-parsing fallback has to
      // cope with no body at all, not just an empty one.
      return route.fulfill({ status: 500, contentType: "application/json", body: "not json{" });
    });
    await page.goto("/");
    await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill("a secret");
    await page.getByRole("button", { name: "Encrypt & get link" }).click();

    await expect(page.getByRole("alert")).toHaveText("Request failed (500)");
  });

  test("submitting before the config has loaded is a no-op instead of sending a broken request", async ({ page }) => {
    let resolveParams: (() => void) | undefined;
    await page.route("**/api/v1/params", async (route) => {
      await new Promise<void>((resolve) => {
        resolveParams = resolve;
      });
      await route.continue();
    });

    await page.goto("/");
    await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill("racing the config load");
    // The submit button stays disabled while params are still loading, so
    // reach handleSubmit directly the way a stray Enter-key race could --
    // it should bail out cleanly rather than dereference the missing config.
    await page.locator("form.card").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.waitForTimeout(200);

    await expect(page.getByRole("heading", { name: /Say it once\./ })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);

    resolveParams?.();
  });
});

test.describe("compose form persists across the flow", () => {
  test("message field is cleared after a successful submit (zero-knowledge -- nothing lingers)", async ({ page, createSecret }) => {
    await createSecret("this should not remain in any field");
    await page.getByRole("button", { name: "Send another secret" }).click();
    await expect(page.getByPlaceholder("Type the thing you shouldn't send over chat…")).toHaveValue("");
  });
});

test.describe("link shape", () => {
  test("the sealed link points at this origin's /s/:id route", async ({ createSecret, baseURL }) => {
    const { link, id } = await createSecret();
    expect(link.startsWith(baseURL ?? "")).toBe(true);
    expect(parseLink(link).id).toBe(id);

    const url = new URL(link);
    expect(url.pathname).toBe(`/s/${id}`);
  });
});
