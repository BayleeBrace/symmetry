import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/stripe";
import { onboardingLink } from "@/lib/card-onboarding";

/**
 * Stripe sends a barber here when their sign-up link has expired or was
 * already opened: make a fresh one and carry on. Signed-in staff only.
 */
export async function GET(req: Request) {
  const back = new URL("/staff?section=settings&tab=payments", req.url);
  try {
    const staff = await requireStaff();
    const barber = new URL(req.url).searchParams.get("barber") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(barber))
      return NextResponse.redirect(back, 303);
    const url = await onboardingLink(
      stripeClient(),
      createAdminClient(),
      staff,
      barber,
    );
    const res = NextResponse.redirect(url, 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch {
    return NextResponse.redirect(back, 303);
  }
}
