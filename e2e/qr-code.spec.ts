import jsQR from "jsqr";
import { expect, test } from "./fixtures";

// QrCode.tsx (added in #29) renders the sealed link as a QR code on the
// "sent" screen via the `qrcode` npm package. A test that only checks "an
// <img> appeared" can't tell a correct QR from one encoding the wrong
// string (or garbage) -- decoding it for real with jsqr (a different,
// independent QR library from the one used to generate it) is what
// actually proves the link round-trips through the image correctly.

async function decodeQr(page: import("@playwright/test").Page, selector: string) {
  const { data, width, height } = await page.evaluate((sel) => {
    const img = document.querySelector(sel) as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { data: Array.from(imageData.data), width: canvas.width, height: canvas.height };
  }, selector);

  return jsQR(new Uint8ClampedArray(data), width, height);
}

test.describe("QR code on the sealed result screen", () => {
  test("renders with the correct accessible name and a real, decodable image", async ({ page, createSecret }) => {
    await createSecret();

    await expect(page.getByText("Scan to open")).toBeVisible();
    const qr = page.getByRole("img", { name: /QR code encoding the one-time secret link/ });
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);

    await expect(page.getByText("The QR carries the key.")).toBeVisible();
    await expect(page.getByText("Treat it like the secret itself.")).toBeVisible();
  });

  test("actually decodes to the exact sealed link, including the key fragment", async ({ page, createSecret }) => {
    const { link } = await createSecret("qr decode probe");

    const qr = page.getByRole("img", { name: /QR code encoding the one-time secret link/ });
    await expect(qr).toBeVisible();

    const decoded = await decodeQr(page, ".qr-frame");
    expect(decoded).not.toBeNull();
    expect(decoded!.data).toBe(link);
    // The key fragment specifically -- the whole point of the caveat text
    // ("treat it like the secret itself") is that the QR carries the key,
    // not just the id.
    expect(decoded!.data).toContain("#");
  });

  test("each secret gets its own QR code, matching its own link", async ({ page, createSecret }) => {
    const first = await createSecret("qr first");
    const firstDecoded = await decodeQr(page, ".qr-frame");
    expect(firstDecoded!.data).toBe(first.link);

    await page.getByRole("button", { name: "Send another secret" }).click();
    const second = await createSecret("qr second");
    const secondDecoded = await decodeQr(page, ".qr-frame");
    expect(secondDecoded!.data).toBe(second.link);

    expect(secondDecoded!.data).not.toBe(firstDecoded!.data);
  });
});
