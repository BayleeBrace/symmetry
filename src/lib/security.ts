import "server-only";
import { createMemoryLimiter } from "./memory-rate-limit";
const previewLimit = createMemoryLimiter();
export class RateLimitExceeded extends Error {
  constructor() {
    super("Too many attempts. Please try again later.");
  }
}
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { createAdminClient, hasSupabase } from "./supabase/admin";
export const siteUrl = () => process.env.APP_URL || "https://symmetrywales.com";
export function signLink(
  scope: string,
  value: string,
  seconds = 60 * 60 * 24 * 180,
) {
  const key = process.env.LINK_SIGNING_SECRET;
  if (!key || key.length < 32)
    throw new Error("Set a strong LINK_SIGNING_SECRET");
  const body = Buffer.from(
    JSON.stringify({
      scope,
      value,
      exp: Math.floor(Date.now() / 1000) + seconds,
    }),
  ).toString("base64url");
  return (
    body + "." + createHmac("sha256", key).update(body).digest("base64url")
  );
}
export function verifyLink(token: string, scope: string): string | null {
  try {
    const key = process.env.LINK_SIGNING_SECRET;
    if (!key) return null;
    const [body, sig] = token.split(".");
    const expected = createHmac("sha256", key).update(body).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.scope === scope &&
      p.exp > Date.now() / 1000 &&
      typeof p.value === "string"
      ? p.value
      : null;
  } catch {
    return null;
  }
}
export async function rateLimit(
  request: Request,
  scope: string,
  limit = 20,
  seconds = 600,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = createHash("sha256")
    .update(scope + ":" + ip)
    .digest("hex");
  if (!hasSupabase()) {
    if (!previewLimit(key, limit, seconds)) throw new RateLimitExceeded();
    return;
  }
  const { data, error } = await createAdminClient().rpc("take_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) throw new Error("Service temporarily unavailable");
  if (!data) throw new RateLimitExceeded();
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const parsed = new URL(origin);
  const sameHost =
    ["http:", "https:"].includes(parsed.protocol) &&
    parsed.host === request.headers.get("host");
  if (
    !sameHost &&
    origin !== new URL(request.url).origin &&
    origin !== siteUrl()
  )
    throw new Error("Invalid request origin");
}
export const privateJson = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
export function publicError(error: unknown, status = 400) {
  return privateJson(
    {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    },
    error instanceof RateLimitExceeded ? 429 : status,
  );
}
