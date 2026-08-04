#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * One-off local dev bootstrap: copies .env.example to .dev.vars and fills in
 * a random PIN_HASH_PEPPER. Run with:
 *   deno run --allow-read --allow-write scripts/gen-dev-vars.ts
 *
 * Uses Deno (not Node) intentionally -- this is a standalone maintenance
 * script, not part of the Worker/Vite build, so it doesn't need the app's
 * npm dependency tree. See CONTRIBUTING.md.
 */

const target = new URL("../.dev.vars", import.meta.url);

try {
  await Deno.stat(target);
  console.error(".dev.vars already exists -- refusing to overwrite it.");
  Deno.exit(1);
} catch (err) {
  if (!(err instanceof Deno.errors.NotFound)) throw err;
}

const example = await Deno.readTextFile(new URL("../.env.example", import.meta.url));
const pepper = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const filled = example.replace(/^PIN_HASH_PEPPER=$/m, `PIN_HASH_PEPPER=${pepper}`);

await Deno.writeTextFile(target, filled);
console.log("Wrote .dev.vars with a freshly generated PIN_HASH_PEPPER.");
