import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Your bookings", robots: { index: false, follow: false } };

export default function BookingsPage() {
  return (
    <main className="information-page">
      <BrandHeader />
      <section className="manage-page">
        <p className="eyebrow">your trims</p>
        <h1>your bookings.</h1>
        <p>Once the booking system is live, the secure link in your confirmation email or text will show every trim you’ve booked.</p>
        <Link className="primary-button" href="/book">book a trim</Link>
      </section>
      <SiteFooter />
    </main>
  );
}
