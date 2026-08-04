import { Hono } from "hono";
import {
  DEFAULT_EXPIRE_SECONDS,
  MAX_EXPIRE_SECONDS,
  MAX_MESSAGE_BYTES,
  MIN_EXPIRE_SECONDS,
  PIN_ATTEMPTS,
  PIN_SIZE,
} from "../../shared/constants";
import { fromBase64Url, toBase64Url } from "../lib/base64url";
import { generateId } from "../lib/id";
import { hashPin, verifyPin } from "../lib/pin";
import { D1Store } from "../lib/store";
import { rateLimit } from "../middleware/rate-limit";

const PIN_PATTERN = new RegExp(`^\\d{${PIN_SIZE}}$`);

const api = new Hono<{ Bindings: Env }>();

api.get("/ping", (c) => c.text("pong"));

api.get("/params", (c) =>
  c.json({
    pinSize: PIN_SIZE,
    minExpireSeconds: MIN_EXPIRE_SECONDS,
    maxExpireSeconds: MAX_EXPIRE_SECONDS,
    defaultExpireSeconds: DEFAULT_EXPIRE_SECONDS,
  }),
);

interface CreateBody {
  data?: unknown;
  pin?: unknown;
  expireSeconds?: unknown;
}

api.post("/message", rateLimit("RATE_LIMITER_CREATE"), async (c) => {
  let body: CreateBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { data, pin, expireSeconds = DEFAULT_EXPIRE_SECONDS } = body;

  if (typeof data !== "string" || data.length === 0) {
    return c.json({ error: "data must be a non-empty base64url string" }, 400);
  }
  if (data.length > MAX_MESSAGE_BYTES) {
    return c.json({ error: `data exceeds the ${MAX_MESSAGE_BYTES}-byte limit` }, 400);
  }
  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
    return c.json({ error: `pin must be exactly ${PIN_SIZE} digits` }, 400);
  }
  if (
    typeof expireSeconds !== "number" ||
    !Number.isInteger(expireSeconds) ||
    expireSeconds < MIN_EXPIRE_SECONDS ||
    expireSeconds > MAX_EXPIRE_SECONDS
  ) {
    return c.json(
      { error: `expireSeconds must be an integer between ${MIN_EXPIRE_SECONDS} and ${MAX_EXPIRE_SECONDS}` },
      400,
    );
  }

  let ciphertext: Uint8Array;
  try {
    ciphertext = fromBase64Url(data);
  } catch {
    return c.json({ error: "data is not valid base64url" }, 400);
  }

  const store = new D1Store(c.env.DB);
  const id = generateId(12);
  const exp = Math.floor(Date.now() / 1000) + expireSeconds;
  const pinHash = await hashPin(pin, c.env.PIN_HASH_PEPPER);

  await store.save({ id, exp, data: ciphertext, pinHash, errors: 0 });

  return c.json({ id, expiresAt: exp }, 201);
});

// Lets the UI show "expired or not found" before asking for a PIN, without
// spending one of the limited PIN attempts or revealing anything about the
// message's contents.
api.get("/message/:id", rateLimit("RATE_LIMITER_REVEAL"), async (c) => {
  const { id } = c.req.param();
  const store = new D1Store(c.env.DB);

  const message = await store.load(id);
  if (!message) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ expiresAt: message.exp });
});

interface RevealBody {
  pin?: unknown;
}

// POST (not GET) so the PIN travels in a JSON body, never in a URL --
// GET-with-PIN-in-path would leak PINs into browser history, proxy/CDN
// access logs, and Referer headers. POST also matches the actual semantics
// here: this deletes the message on success, so it isn't a safe/cacheable
// GET in the first place.
api.post("/message/:id/reveal", rateLimit("RATE_LIMITER_REVEAL"), async (c) => {
  const { id } = c.req.param();
  const store = new D1Store(c.env.DB);

  const message = await store.load(id);
  if (!message) {
    return c.json({ error: "Not found" }, 404);
  }

  let body: RevealBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { pin } = body;

  if (
    typeof pin !== "string" ||
    !PIN_PATTERN.test(pin) ||
    !(await verifyPin(pin, c.env.PIN_HASH_PEPPER, message.pinHash))
  ) {
    const errors = await store.incrementErrors(id);
    if (errors >= PIN_ATTEMPTS) {
      await store.remove(id);
      return c.json({ error: "Too many incorrect attempts, secret has been destroyed" }, 403);
    }
    return c.json({ error: "Incorrect PIN", attemptsRemaining: PIN_ATTEMPTS - errors }, 403);
  }

  // One-time read: delete on the first successful decrypt attempt.
  await store.remove(id);

  return c.json({ data: toBase64Url(message.data) });
});

export default api;
