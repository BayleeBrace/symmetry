import { finalizeBooking } from "@/lib/finalize-booking";
import {
  privateJson,
  publicError,
  rateLimit,
  sameOrigin,
} from "@/lib/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await rateLimit(request, "complete");
    const { session, completion } = await request.json();
    if (typeof session !== "string" || !/^cs_[a-zA-Z0-9_]+$/.test(session))
      return privateJson({ error: "Invalid card setup" }, 400);
    // The token this tab was given when the booking started. Without it the
    // trim is still booked, but the manage link only goes out by email.
    const { group, token } = await finalizeBooking(session, {
      token:
        typeof completion === "string" && completion.length <= 100
          ? completion
          : undefined,
    });
    return privateJson(token ? { group, token } : { booked: true });
  } catch (e) {
    return publicError(e, 409);
  }
}
