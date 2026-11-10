import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/security";
import {
  CardError,
  barberAccountIds,
  cardMode,
  createBarberAccount,
} from "@/lib/card-payments";

type Staff = { user_id: string; barber_id: string | null; role: string };

/**
 * A fresh Stripe sign-up link for a barber's own account, opening it first if
 * they have none. Each barber opens their own from the app; in practice mode
 * the owner can also open one for anyone, since it only holds test details.
 */
export async function onboardingLink(
  stripe: Stripe,
  db: SupabaseClient,
  staff: Staff,
  barberId: string,
) {
  if (
    staff.barber_id !== barberId &&
    !(staff.role === "owner" && cardMode() === "test")
  )
    throw new CardError(
      "Each barber sets up their own card payments, signed in as themselves.",
    );
  const { data: barber } = await db
    .from("barbers")
    .select("id,name")
    .eq("id", barberId)
    .single();
  if (!barber) throw new CardError("That chair is not in the shop");
  let id = (await barberAccountIds(stripe)).get(barberId);
  if (!id) {
    const { data: member } = await db
      .from("staff_members")
      .select("user_id")
      .eq("barber_id", barberId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    let email: string | undefined;
    if (member) {
      const { data } = await db.auth.admin.getUserById(member.user_id);
      email = data.user?.email ?? undefined;
    }
    id = (await createBarberAccount(stripe, barber, email)).id;
  }
  const back = siteUrl() + "/staff?section=settings&tab=payments";
  const link = await stripe.v2.core.accountLinks.create({
    account: id,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant", "recipient"],
        refresh_url:
          siteUrl() +
          "/api/staff/card/onboard?barber=" +
          encodeURIComponent(barberId),
        return_url: back,
      },
    },
  });
  return link.url;
}
