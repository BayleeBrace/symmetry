import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/stripe";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
import {
  CardError,
  accountState,
  barberAccountIds,
  cardMessage,
  cardMode,
  ensureTipping,
  shopLocation,
  shopReader,
} from "@/lib/card-payments";
import { onboardingLink } from "@/lib/card-onboarding";
import { addTestCards } from "@/lib/test-data";

/**
 * Card payments set-up: whether Stripe is connected and in practice mode, the
 * shop's card machine, and each barber's own account. Everyone sees the
 * machine and their own chair; the owner sees every chair.
 */
export async function GET() {
  try {
    const staff = await requireStaff();
    const mode = cardMode();
    if (!mode) return privateJson({ mode: null });
    const stripe = stripeClient();
    const db = createAdminClient();
    const owner = staff.role === "owner";
    const [{ data: barbers }, ids, reader] = await Promise.all([
      db
        .from("barbers")
        .select("id,name,display_order")
        .eq("active", true)
        .order("display_order"),
      barberAccountIds(stripe),
      shopReader(stripe),
    ]);
    const chairs = (barbers ?? []).filter(
      (b) => owner || b.id === staff.barber_id,
    );
    const rows = await Promise.all(
      chairs.map(async (b) => {
        const id = ids.get(b.id);
        const state = id ? await accountState(stripe, id) : null;
        return {
          id: b.id,
          name: b.name,
          mine: b.id === staff.barber_id,
          started: Boolean(id),
          ready: state?.ready ?? false,
          needs_details: state?.needsDetails ?? true,
        };
      }),
    );
    return privateJson({
      mode,
      owner,
      reader: reader
        ? {
            label: reader.label,
            status: reader.status,
            simulated: reader.device_type.startsWith("simulated"),
          }
        : null,
      barbers: rows,
    });
  } catch (e) {
    return publicError(new Error(cardMessage(e) || (e as Error).message), 409);
  }
}

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("onboard"), barber: z.uuid() }),
  z.object({ action: z.literal("dashboard") }),
  z.object({
    action: z.literal("add_reader"),
    // The words a real machine shows when it's ready to register. Practice mode makes a pretend one.
    code: z.string().trim().min(3).max(60).optional(),
  }),
]);

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff();
    const p = actions.parse(await req.json());
    const mode = cardMode();
    if (!mode) throw new CardError("Stripe isn’t connected yet");
    const stripe = stripeClient();
    const db = createAdminClient();
    if (p.action === "onboard")
      return privateJson({
        url: await onboardingLink(stripe, db, staff, p.barber),
      });
    if (p.action === "dashboard") {
      if (!staff.barber_id) throw new CardError("Your sign-in has no chair");
      const id = (await barberAccountIds(stripe)).get(staff.barber_id);
      if (!id) throw new CardError("Set up card payments first");
      try {
        const link = await stripe.accounts.createLoginLink(id);
        return privateJson({ url: link.url });
      } catch {
        throw new CardError(
          "Finish setting up with Stripe first, then your payouts appear here.",
        );
      }
    }
    if (staff.role !== "owner")
      throw new CardError("Only the owner can add the card machine");
    if (mode === "live" && !p.code)
      throw new CardError("Type the words shown on the card machine’s screen");
    const location = await shopLocation(stripe);
    // The tip screen on every payment, as Sean chose.
    await ensureTipping(stripe, location);
    const reader = await stripe.terminal.readers.create({
      registration_code: mode === "test" ? "simulated-s700" : p.code!,
      label: mode === "test" ? "Practice card machine" : "Shop card machine",
      location: location.id,
    });
    // Test clients added before Stripe was connected get their test cards now.
    if (mode === "test") await addTestCards(stripe).catch(() => 0);
    return privateJson({ ok: true, label: reader.label });
  } catch (e) {
    return publicError(new Error(cardMessage(e) || (e as Error).message), 409);
  }
}
