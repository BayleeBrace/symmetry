import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";
import { getCatalog } from "@/lib/catalog";
import { WaitlistForm } from "./form";
export const metadata = {
  title: "Cancellation waitlist",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; leave?: string }>;
}) {
  const p = await searchParams;
  const catalog = await getCatalog();
  return (
    <main className="information-page">
      <BrandHeader compact />
      <section className="information-hero customer-content">
        <h1>Next in line.</h1>
        <p>
          Tell us when you’d like a trim. We’ll email if space opens up. A
          waitlist alert doesn’t reserve a time.
        </p>
        <WaitlistForm
          token={p.verify || p.leave}
          leave={Boolean(p.leave)}
          services={catalog.services.map((s) => ({ id: s.id, name: s.name }))}
        />
      </section>
      <SiteFooter />
    </main>
  );
}
