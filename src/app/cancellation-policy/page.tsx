export const dynamic = "force-dynamic";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactLinks } from "@/components/contact-links";
import { getPolicy } from "@/lib/catalog";
export const metadata = {
  title: "Cancellation policy",
  alternates: { canonical: "/cancellation-policy" },
};
export default async function Page() {
  const p = await getPolicy();
  return (
    <main className="information-page">
      <BrandHeader />
      <section className="information-hero">
        <h1>Plans change.</h1>
        <p>No deposit is taken. Your card is saved securely when you book.</p>
        <p>
          Cancel at least {p.cancellation_hours} hours before your trim for
          free.
        </p>
        <p>
          Cancel with less notice and a {p.late_percent}% fee applies. If you do
          not attend, the fee is {p.no_show_percent}% of your booked service
          price.
        </p>
        <p>
          Within the cancellation window, contact the shop if you need to move
          your trim. Fees are based on the price agreed for that appointment.
        </p>
        <ContactLinks fallback />
      </section>
      <SiteFooter />
    </main>
  );
}
