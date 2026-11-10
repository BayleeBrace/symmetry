import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { stripeClient } from "@/lib/stripe";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
import { cardMode } from "@/lib/card-payments";
import {
  addTestCards,
  addTestData,
  countTestClients,
  removeTestData,
  testClientsWithoutCards,
} from "@/lib/test-data";

/** Owner only: how many test clients are in, and adding or removing them. */
export async function GET() {
  try {
    await requireStaff(true);
    const mode = cardMode();
    return privateJson({
      clients: await countTestClients(),
      mode,
      without_cards: mode === "test" ? await testClientsWithoutCards() : 0,
    });
  } catch (e) {
    return publicError(e, 409);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await requireStaff(true);
    const { action } = z
      .object({ action: z.enum(["add", "remove", "cards"]) })
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
    if (action === "cards") {
      if (!stripe) throw new Error("Test cards need Stripe's practice mode");
      return privateJson({ ok: true, cards: await addTestCards(stripe) });
    }
    return privateJson({ ok: true, ...(await removeTestData(stripe)) });
  } catch (e) {
    return publicError(e, 409);
  }
}
