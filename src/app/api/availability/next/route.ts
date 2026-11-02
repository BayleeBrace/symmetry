import { z } from "zod";
import { nextFree } from "@/lib/next-free";
import { hasSupabase } from "@/lib/supabase/admin";
import { privateJson, publicError, rateLimit } from "@/lib/security";

/** The soonest few times for a service, so a customer can skip the calendar. */
export async function GET(req: Request) {
  try {
    await rateLimit(req, "availability-next", 120);
    const { barber, service } = z
      .object({
        barber: z.enum(["sean", "travis", "dylan", "any"]),
        service: z.string().max(40),
      })
      .parse(Object.fromEntries(new URL(req.url).searchParams));
    return privateJson({
      mode: hasSupabase() ? "live" : "preview",
      slots: await nextFree(barber, service),
    });
  } catch (e) {
    return publicError(e, 503);
  }
}
