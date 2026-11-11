import { z } from "zod";
import { after } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { createAdminClient, hasSupabase } from "@/lib/supabase/admin";
import { getCatalog } from "@/lib/catalog";
import { notifyWaitlistJoined } from "@/lib/staff-push";
import {
  sameOrigin,
  rateLimit,
  signLink,
  verifyLink,
  siteUrl,
  privateJson,
  publicError,
} from "@/lib/security";
import {
  validDate,
  shopToday,
  addDays,
  onlineHorizon,
} from "@/lib/booking-data";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await rateLimit(req, "waitlist", 5, 3600);
    const p = z
      .object({
        email: z.email().max(254),
        barber: z.enum(["sean", "travis", "dylan", "any"]),
        service: z.string().max(40),
        date: z.string().refine(validDate),
        // Optional: any day from date up to this one (two weeks at most).
        until: z.string().refine(validDate).or(z.literal("")).optional(),
      })
      .parse(await req.json());
    if (p.date < shopToday() || p.date > onlineHorizon(shopToday()))
      throw new Error("Choose a date within the next two months");
    const until = p.until && p.until > p.date ? p.until : null;
    if (until && until > addDays(p.date, 14))
      throw new Error("Choose a run of up to two weeks");
    // The site preview has no database: check the request, save nothing.
    if (!hasSupabase()) {
      const { services } = await getCatalog();
      if (!services.some((s) => s.id === p.service))
        throw new Error("Choose a service and barber");
      return privateJson({
        mode: "preview",
        message:
          "This is a preview, so no waitlist request was saved and no email was sent.",
      });
    }
    // The confirm link needs the signing key; check it before saving anything.
    if ((process.env.LINK_SIGNING_SECRET?.length || 0) < 32)
      return privateJson(
        {
          error: "The waitlist is not open yet. Please contact the shop.",
        },
        503,
      );
    const db = createAdminClient();
    const { data: s } = await db
      .from("services")
      .select("id")
      .eq("slug", p.service)
      .eq("active", true)
      .single();
    const { data: b } = await db
      .from("barbers")
      .select("id")
      .eq("slug", p.barber)
      .eq("active", true)
      .maybeSingle();
    if (!s || (p.barber !== "any" && !b))
      throw new Error("Choose a service and barber");
    const { data, error } = await db
      .from("waitlist_requests")
      .insert({
        email: p.email.toLowerCase(),
        barber_id: b?.id || null,
        service_id: s.id,
        preferred_date: p.date,
        ...(until ? { until_date: until } : {}),
        token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
      })
      .select("id")
      .single();
    if (error) throw new Error("Could not join the waitlist");
    const { error: j } = await db.from("notification_jobs").insert({
      dedupe_key: "verify-waitlist-" + data.id,
      kind: "waitlist_verify",
      channel: "email",
      payload: {
        email: p.email,
        url:
          siteUrl() +
          "/waitlist?verify=" +
          signLink("waitlist", data.id, 86400),
      },
    });
    if (j) throw new Error("Confirmation could not be queued");
    return privateJson({
      message: "Check your email to confirm your waitlist request.",
    });
  } catch (e) {
    return publicError(e);
  }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const { token, action } = z
      .object({ token: z.string(), action: z.enum(["verify", "leave"]) })
      .parse(await req.json());
    const id = verifyLink(token, "waitlist");
    if (!id) throw new Error("Link expired. Please join again.");
    const { error } = await createAdminClient()
      .from("waitlist_requests")
      .update(action === "verify" ? { verified: true } : { active: false })
      .eq("id", id);
    if (error) throw new Error("Could not update waitlist");
    if (action === "verify") after(() => notifyWaitlistJoined(id));
    return privateJson({
      message:
        action === "verify"
          ? "You’re on the list. We’ll email if a time becomes available."
          : "You’ve left the waitlist.",
    });
  } catch (e) {
    return publicError(e);
  }
}
