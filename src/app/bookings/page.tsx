import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";
import { ManageBookings } from "./manage-bookings";

export const metadata: Metadata = { title: "Your bookings", robots: { index: false, follow: false } };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <main className="information-page">
      <BrandHeader />
      <section className="manage-page">
        <p className="eyebrow">your trims</p>
        <h1>your bookings.</h1>
        {token ? <ManageBookings token={token} /> : <>
          <p>Open the secure link in your confirmation email or text to move, cancel or add your trims to your calendar.</p>
          <Link className="primary-button" href="/book">book a trim</Link>
        </>}
      </section>
      <SiteFooter />
    </main>
  );
}
