import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/stripe";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff(true);
    const { id, action } = z
      .object({ id: z.uuid(), action: z.enum(["charge", "waive"]) })
      .parse(await req.json());
    const db = createAdminClient();
    if (action === "waive") {
      const { data, error } = await db
        .from("bookings")
        .update({ fee_status: "waived" })
        .eq("id", id)
        .eq("fee_status", "review")
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("This fee cannot be waived now");
      return privateJson({ ok: true });
    }
    if (process.env.CARD_CHARGES_ENABLED !== "true")
      throw new Error("Card charges are not enabled yet");
    const { data: b, error } = await db
      .from("bookings")
      .select(
        "*,booking_groups(stripe_customer,stripe_payment_method,policy_snapshot,policy_accepted_at)",
      )
      .eq("id", id)
      .single();
    if (
      error ||
      !b ||
      !["review", "charging"].includes(b.fee_status) ||
      !["no_show", "cancelled"].includes(b.status) ||
      b.fee_pence <= 0
    )
      throw new Error("No fee is awaiting review");
    const g = b.booking_groups;
    if (
      !g?.stripe_customer ||
      !g?.stripe_payment_method ||
      !g?.policy_accepted_at
    )
      throw new Error("No authorised saved card is available");
    const expected = Math.round(
      (b.price_pence *
        (b.status === "no_show"
          ? g.policy_snapshot.no_show_percent
          : g.policy_snapshot.late_percent)) /
        100,
    );
    if (b.fee_pence !== expected)
      throw new Error("Fee does not match the accepted policy");
    const stripe = stripeClient();
    let intentId = b.payment_intent as string | null;
    if (b.fee_status === "review") {
      const { data: claimed, error: claimError } = await db
        .from("bookings")
        .update({ fee_status: "charging" })
        .eq("id", id)
        .eq("fee_status", "review")
        .select("id")
        .maybeSingle();
      if (claimError || !claimed)
        throw new Error(
          "This fee has already been changed. Refresh the diary.",
        );
      // Persist the intent before confirming it. An interrupted attempt cannot create a second charge.
      const draft = await stripe.paymentIntents.create(
        {
          amount: b.fee_pence,
          currency: "gbp",
          customer: g.stripe_customer,
          payment_method: g.stripe_payment_method,
          description: `Symmetry ${b.status === "no_show" ? "no-show" : "late cancellation"} fee`,
          metadata: { booking: id },
        },
        { idempotencyKey: "fee-create-" + id },
      );
      const { error: save } = await db
        .from("bookings")
        .update({ payment_intent: draft.id })
        .eq("id", id)
        .eq("fee_status", "charging");
      if (save)
        throw new Error(
          "Fee paused before payment. Check the Stripe record before continuing.",
        );
      intentId = draft.id;
    }
    if (!intentId)
      throw new Error(
        "This interrupted fee needs manual reconciliation in Stripe before continuing.",
      );
    let pi = await stripe.paymentIntents.retrieve(intentId);
    if (pi.amount !== b.fee_pence || pi.metadata.booking !== id)
      throw new Error("Payment record does not match this fee");
    if (pi.status === "requires_confirmation")
      pi = await stripe.paymentIntents.confirm(
        intentId,
        { off_session: true },
        { idempotencyKey: "fee-confirm-" + id },
      );
    const status =
      pi.status === "succeeded"
        ? "charged"
        : pi.status === "processing"
          ? "charging"
          : "failed";
    const { error: save } = await db
      .from("bookings")
      .update({ fee_status: status })
      .eq("id", id)
      .eq("payment_intent", intentId);
    if (save)
      throw new Error("Payment submitted. Refresh to reconcile its status.");
    await db.from("booking_events").insert({
      booking_id: id,
      group_id: b.group_id,
      kind: status === "charged" ? "fee_charged" : "fee_checked",
      actor: staff.user_id,
      detail: {
        amount: b.fee_pence,
        payment_intent: intentId,
        status: pi.status,
      },
    });
    return privateJson({ ok: true, status: pi.status });
  } catch (e) {
    return publicError(e, 409);
  }
}
