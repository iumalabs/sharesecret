import { Hono } from "hono";
import { securityHeaders } from "./middleware/security-headers";
import api from "./routes/api";

const app = new Hono<{ Bindings: Env }>();

app.use("*", securityHeaders);
app.route("/api/v1", api);

export default app;
