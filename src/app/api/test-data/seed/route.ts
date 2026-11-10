import { timingSafeEqual } from "node:crypto";
import { privateJson, publicError } from "@/lib/security";
import { stripeClient } from "@/lib/stripe";
import { cardMode } from "@/lib/card-payments";
import { addTestData, countTestClients, removeTestData } from "@/lib/test-data";

/**
 * One-off, for whoever set it up: puts the test clients in without signing
 * in, using a long random key saved in Vercel as SEED_TEST_DATA_KEY. With
 * ?fresh=1 it first takes out any old test clients, so the trims start from
 * today. Does nothing at all without the key, or once card payments are live.
 * Clear the key in Vercel once it's done.
 */
export async function GET(req: Request) {
  try {
    const key = process.env.SEED_TEST_DATA_KEY ?? "";
    const params = new URL(req.url).searchParams;
    const given = params.get("key") ?? "";
    if (
      key.length < 32 ||
      given.length !== key.length ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(key))
    )
      return privateJson({ error: "Not found" }, 404);
    const mode = cardMode();
    if (mode === "live")
      return privateJson({ skipped: "Card payments are live" });
    const stripe = mode === "test" ? stripeClient() : null;
    const before = await countTestClients();
    const removed =
      before > 0 && params.get("fresh") === "1"
        ? await removeTestData(stripe)
        : null;
    if (before > 0 && !removed)
      return privateJson({ skipped: "Already in", clients: before });
    return privateJson({ removed, added: await addTestData(stripe) });
  } catch (e) {
    return publicError(e, 500);
  }
}
