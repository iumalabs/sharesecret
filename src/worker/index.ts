import { Hono } from "hono";

const PIN_SIZE = 5;
const MAX_EXPIRE_SECONDS = 24 * 60 * 60;

const app = new Hono<{ Bindings: Env }>();

app.get("/api/v1/ping", (c) => c.text("pong"));

app.get("/api/v1/params", (c) =>
  c.json({
    pinSize: PIN_SIZE,
    maxExpireSeconds: MAX_EXPIRE_SECONDS,
  }),
);

export default app;
