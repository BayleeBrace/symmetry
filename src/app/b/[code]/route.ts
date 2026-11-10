import { NextResponse } from "next/server";
import { readShortCode } from "@/lib/short-link";
import { signLink } from "@/lib/security";

/**
 * The short booking link from a text message. A valid code is swapped for
 * the full signed booking link; anything else lands on the bookings page,
 * where the customer can ask for a fresh link by email.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const key = process.env.LINK_SIGNING_SECRET;
  const group = key && key.length >= 32 ? readShortCode(code, key) : null;
  const to = new URL(
    group ? "/bookings?token=" + signLink("manage", group) : "/bookings",
    req.url,
  );
  const res = NextResponse.redirect(to, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
