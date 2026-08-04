// `wrangler types` only knows about bindings declared in wrangler.jsonc.
// Secrets set out-of-band (`wrangler secret put` / `.dev.vars`) need to be
// added to the ambient `Env` interface by hand -- it's declared as an open
// interface in the generated worker-configuration.d.ts, so this merges in.
export {};

declare global {
  interface Env {
    /** PBKDF2 pepper for PIN hashing. See CONTRIBUTING.md / .env.example. */
    PIN_HASH_PEPPER: string;
  }
}
