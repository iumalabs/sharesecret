import { Hono } from "hono";
import { D1Store } from "./lib/store";
import { securityHeaders } from "./middleware/security-headers";
import api from "./routes/api";

const app = new Hono<{ Bindings: Env }>();

app.use("*", securityHeaders);
app.route("/api/v1", api);

// Client-side routed SPA (e.g. /s/:id) -- serve the app shell for anything
// that isn't an API route or a real static file, so the browser router can
// take over.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,

  // D1Store.load() already lazily deletes an expired row the moment
  // something tries to read it, but nothing ever reads most expired
  // secrets -- this cron sweeps those up so they don't sit in the database
  // forever. See wrangler.jsonc `triggers.crons`.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const deleted = await new D1Store(env.DB).purgeExpired();
    if (deleted > 0) console.log(`cron cleanup: purged ${deleted} expired secret(s)`);
  },
} satisfies ExportedHandler<Env>;
