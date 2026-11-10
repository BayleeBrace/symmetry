import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { stripeClient } from "@/lib/stripe";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
import { cardMode } from "@/lib/card-payments";
import { addTestData, countTestClients, removeTestData } from "@/lib/test-data";

/** Owner only: how many test clients are in, and adding or removing them. */
export async function GET() {
  try {
    await requireStaff(true);
    return privateJson({ clients: await countTestClients(), mode: cardMode() });
  } catch (e) {
    return publicError(e, 409);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await requireStaff(true);
    const { action } = z
      .object({ action: z.enum(["add", "remove"]) })
      .parse(await req.json());
    const mode = cardMode();
    // Test cards only exist in Stripe's practice mode.
    const stripe = mode === "test" ? stripeClient() : null;
    if (action === "add") {
      if (mode === "live")
        throw new Error(
          "Card payments are live, so test clients can't be added now.",
        );
      return privateJson({ ok: true, ...(await addTestData(stripe)) });
    }
    return privateJson({ ok: true, ...(await removeTestData(stripe)) });
  } catch (e) {
    return publicError(e, 409);
  }
}
