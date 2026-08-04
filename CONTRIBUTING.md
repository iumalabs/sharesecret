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
| `npm run cf-typegen`              | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` bindings           |

## Pull requests

- One focused change per PR. CI (lint, typecheck, test, build, CodeQL, gitleaks) must be green before merge.
- No secrets, API tokens, or `.dev.vars` in commits — `.env.example` documents required variables without values.
- Security-relevant changes (crypto, PIN handling, storage, headers) should call out the reasoning in the PR description, not just the diff.
