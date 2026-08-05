# Contributing

## Stack

- **Runtime:** Cloudflare Workers (via
  [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)) — a single Worker serves both the
  Hono API and the built React SPA.
- **API:** [Hono](https://hono.dev/), TypeScript.
- **UI:** React 19 + Vite.
- **Storage:** Cloudflare D1 (SQLite).
- **Build & tooling:** [Deno](https://deno.com/) — `deno.json` is the only manifest (no
  `package.json`/`package-lock.json`, no `tsconfig.json`). All dependencies are npm packages, resolved via Deno's `npm:`
  specifiers and `deno.lock`; every `deno task` below just runs the same underlying tool (Vite, Wrangler, Vitest,
  Playwright) through Deno instead of Node. `nodeModulesDir: "auto"` in `deno.json` still materializes a local
  `node_modules/` (gitignored) since these tools assume Node-style resolution -- Deno itself only replaces the package
  manager and task runner here, not the build stack.
- **Type checking:** `deno check` instead of `tsc`, via a
  [Deno workspace](https://docs.deno.com/runtime/fundamentals/workspaces/) with two members -- `src/worker/deno.json`
  (no DOM lib; `types` points at `worker-configuration.d.ts` + `@cloudflare/vitest-pool-workers/types`) and
  `src/react-app/deno.json` (DOM + `jsx: react-jsx`). The split matters, not just for tidiness: it's what keeps
  browser-only globals (`window`, `document`, `localStorage`) out of Worker code at typecheck time, and Worker-only
  ambient types out of the React app. Verified with a negative-control check before relying on it (a deliberate
  `window.` reference in `src/worker/` correctly fails `deno check`, same as it did under the old `tsc`
  project-reference setup). `DENO_COMPAT=1` (extensionless relative imports, matching the app's existing bundler-style
  import convention) is required for `deno check` to resolve this codebase's imports -- it's baked into the `typecheck`
  task, not something you need to set yourself.
- **Lint & format:** `deno lint` / `deno fmt` instead of ESLint/Prettier (config lives in `deno.json`'s `lint`/`fmt`
  fields, not separate dotfiles). `deno lint` runs with the `recommended` + `react` rule tags, minus `no-window` /
  `no-window-prefix` -- those two assume Deno-as-runtime code where `window` doesn't exist; this is a browser-facing SPA
  where `window` is correct and expected everywhere in `src/react-app/` and inside Playwright's `page.evaluate()`
  callbacks in `e2e/`, and the actual Worker/DOM boundary is already enforced more precisely by `deno check`'s
  restricted `lib` (see above). One real gap worth knowing about: `deno lint` has no equivalent to
  `eslint-plugin-react-hooks`'s `exhaustive-deps` rule (dependency-array correctness for `useEffect`/`useCallback`) --
  it does have `react-rules-of-hooks` (hooks called unconditionally), which is enabled. This was a deliberate, disclosed
  tradeoff, not an oversight: `exhaustive-deps` caught a real stale-closure bug earlier in this project, and there's
  currently no Deno-native substitute for it -- extra care (or manual review) on `useEffect` dependency arrays is
  warranted until/unless that changes.
- **`vite.config.ts` lives in `src/react-app/`**, not the repo root -- but Vite's project `root` still points at the
  repo root (where `index.html` and `wrangler.jsonc` live), via an explicit `root` option inside that config file.
  Config-file _location_ and Vite's `root` _option_ are independent; conflating them -- setting the `root` option itself
  to `src/react-app` instead of just moving the config file there -- breaks `@cloudflare/vite-plugin`'s `wrangler.jsonc`
  auto-detection and produces an assets-only worker bundle, which was hit and understood earlier in this project's
  history. Every `deno task` that invokes Vite (`dev`, `build`, `preview`) passes
  `--config src/react-app/vite.config.ts` explicitly; you don't need to think about this unless you're adding a new Vite
  invocation somewhere.

## Setup

```bash
deno install
cp .env.example .dev.vars   # or: deno task gen-dev-vars
wrangler d1 create sharesecret-db   # first time only; paste the returned database_id into wrangler.jsonc
deno task db:migrate:local
deno task dev
```

## Scripts

| Command                             | Purpose                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `deno task dev`                     | Vite dev server (Worker + React, hot reload)                                    |
| `deno task build`                   | Production build (`dist/client` + Worker bundle)                                |
| `deno task deploy`                  | Build and `wrangler deploy`                                                     |
| `deno task lint` / `lint:fix`       | `deno lint`                                                                     |
| `deno task format` / `format:check` | `deno fmt`                                                                      |
| `deno task typecheck`               | `deno check` for both the Worker and the React app (see Type checking above)    |
| `deno task test`                    | Vitest (`@cloudflare/vitest-pool-workers`, runs against a real Workers runtime) |
| `deno task test:e2e`                | Playwright end-to-end suite (`e2e/`), against a real local dev server           |
| `deno task test:e2e:ui`             | Same, in Playwright's interactive UI mode                                       |
| `deno task cf-typegen`              | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` bindings           |

## End-to-end tests

`e2e/` holds a Playwright suite that drives the real app (compose, reveal/PIN, error states, nav, a11y, rate limiting)
against `deno task dev` -- not mocks. First time setup, on top of the steps above:

```bash
deno run -A npm:playwright install --with-deps chromium
deno task test:e2e
```

It starts its own dev server on port 5183 (see `e2e/playwright.config.ts`) against your local D1, so run
`deno task db:migrate:local` first if you haven't. Each test uses a synthetic `CF-Connecting-IP` so tests don't share
rate-limit buckets with each other (see the comment in `e2e/fixtures.ts`); `e2e/rate-limit.spec.ts` exercises the
limiters directly and deliberately doesn't pin an exact request-count boundary, since the local rate limiter simulation
is approximate under load -- under real CPU contention (e.g. running the full suite at high worker concurrency)
individual rate-limit or timing-sensitive tests can flake; re-running in isolation is the first thing to try before
assuming a regression. A couple of tests are intentionally marked `test.fail()` with a linked GitHub issue -- they
document known bugs found while writing this suite rather than being disabled outright, and should flip back to plain
assertions once the underlying issue is fixed.

## Pull requests

- One focused change per PR. CI (lint, typecheck, test, e2e, build, CodeQL, gitleaks) must be green before merge.
- No secrets, API tokens, or `.dev.vars` in commits — `.env.example` documents required variables without values.
- Note: `deno task build` copies `.dev.vars` into `dist/sharesecret/` (this is `@cloudflare/vite-plugin` behavior, so
  `vite preview` can run against a Worker locally). `dist/` is gitignored, but don't manually publish or archive the
  `dist/` directory anywhere it could leak your local `.dev.vars`.
- Security-relevant changes (crypto, PIN handling, storage, headers) should call out the reasoning in the PR
  description, not just the diff.
