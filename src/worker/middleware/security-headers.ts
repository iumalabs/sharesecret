import type { MiddlewareHandler } from "hono";

/**
 * No inline scripts/styles, no framing, no third-party origins -- the app
 * ships all of its own JS/CSS and doesn't need anything else.
 */
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Content-Security-Policy", CSP);
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
};
