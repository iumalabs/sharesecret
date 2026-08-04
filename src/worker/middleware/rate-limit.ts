import type { MiddlewareHandler } from "hono";

/**
 * `CF-Connecting-IP` is set by Cloudflare's edge and can't be spoofed by the
 * client (Cloudflare overwrites any client-supplied value) -- safe to use
 * directly as the rate-limit key.
 */
function clientKey(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

export function rateLimit(binding: keyof Env & ("RATE_LIMITER_CREATE" | "RATE_LIMITER_REVEAL")): MiddlewareHandler<{
  Bindings: Env;
}> {
  return async (c, next) => {
    const limiter = c.env[binding];
    const { success } = await limiter.limit({ key: clientKey(c) });
    if (!success) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  };
}
