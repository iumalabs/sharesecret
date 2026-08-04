import { Hono } from "hono";
import { securityHeaders } from "./middleware/security-headers";
import api from "./routes/api";

const app = new Hono<{ Bindings: Env }>();

app.use("*", securityHeaders);
app.route("/api/v1", api);

// Client-side routed SPA (e.g. /s/:id) -- serve the app shell for anything
// that isn't an API route or a real static file, so the browser router can
// take over.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
