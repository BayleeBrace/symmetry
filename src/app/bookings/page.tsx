import { BrandHeader } from "@/components/brand-header";
import { ManageBookings } from "./manage-bookings";
import { Recovery, SetupComplete } from "./recovery";
import { verifyLink, signLink } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
export const metadata = {
  title: "Your bookings",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; setup?: string; account?: string }>;
}) {
  const p = await searchParams;
  const email = p.account ? verifyLink(p.account, "account") : null;
  let history: { id: string; created_at: string }[] = [];
  if (email) {
    const db = createAdminClient();
    const { data: c, error: e } = await db
      .from("customers")
      .select("id")
      .eq("email", email);
    if (!e && c?.length) {
      const { data } = await db
        .from("booking_groups")
        .select("id,created_at")
        .in(
          "customer_id",
          c.map((x) => x.id),
        )
        .order("created_at", { ascending: false })
        .limit(100);
      history = data || [];
    }
  }
  return (
    <main className="information-page">
      <BrandHeader compact />
      <section className="staff-content">
        <h1>Your trims.</h1>
        {p.setup ? (
          <SetupComplete session={p.setup} />
        ) : p.token ? (
          <ManageBookings token={p.token} />
        ) : email ? (
          <>
            <p>Your booking history.</p>
            {history.map((g) => (
              <p key={g.id}>
                <a
                  className="primary-button"
                  href={"/bookings?token=" + signLink("manage", g.id)}
                >
                  Booking made{" "}
                  {new Date(g.created_at).toLocaleDateString("en-GB")}
                </a>
              </p>
            ))}
            {!history.length && <p>No bookings found for this email.</p>}
          </>
        ) : (
          <>
            <p>Enter your email to find your bookings.</p>
            <Recovery />
          </>
        )}
      </section>
    </main>
  );
}
