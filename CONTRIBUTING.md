# Contributing

## Stack

- **Runtime:** Cloudflare Workers (via [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)) — a single Worker serves both the Hono API and the built React SPA.
- **API:** [Hono](https://hono.dev/), TypeScript.
- **UI:** React 19 + Vite.
- **Storage:** Cloudflare D1 (SQLite).
- **Tooling scripts:** [Deno](https://deno.com/) for standalone maintenance scripts under `scripts/` (not part of the app build — no npm dependency needed to run them).

## Setup

```bash
npm install
cp .env.example .dev.vars   # or: deno run --allow-read --allow-write scripts/gen-dev-vars.ts
wrangler d1 create sharesecret-db   # first time only; paste the returned database_id into wrangler.jsonc
npm run db:migrate:local
npm run dev
```

## Scripts

| Command                           | Purpose                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server (Worker + React, hot reload)                                    |
| `npm run build`                   | Production build (`dist/client` + Worker bundle)                                |
| `npm run deploy`                  | Build and `wrangler deploy`                                                     |
| `npm run lint` / `lint:fix`       | ESLint                                                                          |
| `npm run format` / `format:check` | Prettier                                                                        |
| `npm run typecheck`               | `tsc --noEmit` for both the Worker and the React app                            |
| `npm test`                        | Vitest (`@cloudflare/vitest-pool-workers`, runs against a real Workers runtime) |
| `npm run test:e2e`                | Playwright end-to-end suite (`e2e/`), against a real local dev server          |
| `npm run test:e2e:ui`             | Same, in Playwright's interactive UI mode                                      |
| `npm run cf-typegen`              | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` bindings           |

## End-to-end tests

`e2e/` holds a Playwright suite that drives the real app (compose, reveal/PIN, error states, nav, a11y, rate limiting) against `npm run dev` -- not mocks. First time setup, on top of the steps above:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

It starts its own dev server on port 5183 (see `playwright.config.ts`) against your local D1, so run `npm run db:migrate:local` first if you haven't. Each test uses a synthetic `CF-Connecting-IP` so tests don't share rate-limit buckets with each other (see the comment in `e2e/fixtures.ts`); `e2e/rate-limit.spec.ts` exercises the limiters directly and deliberately doesn't pin an exact request-count boundary, since the local rate limiter simulation is approximate under load. A couple of tests are intentionally marked `test.fail()` with a linked GitHub issue -- they document known bugs found while writing this suite rather than being disabled outright, and should flip back to plain assertions once the underlying issue is fixed.

## Pull requests

- One focused change per PR. CI (lint, typecheck, test, e2e, build, CodeQL, gitleaks) must be green before merge.
- No secrets, API tokens, or `.dev.vars` in commits — `.env.example` documents required variables without values.
- Note: `npm run build` copies `.dev.vars` into `dist/sharesecret/` (this is `@cloudflare/vite-plugin` behavior, so `vite preview` can run against a Worker locally). `dist/` is gitignored, but don't manually publish or archive the `dist/` directory anywhere it could leak your local `.dev.vars`.
- Security-relevant changes (crypto, PIN handling, storage, headers) should call out the reasoning in the PR description, not just the diff.
