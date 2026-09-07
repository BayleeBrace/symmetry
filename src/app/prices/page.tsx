export const dynamic = 'force-dynamic';
import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";
import { getCatalog } from "@/lib/catalog";
import { BARBERS, money } from "@/lib/booking-data";

export const metadata: Metadata = {
  title: "Barber Prices in Saundersfoot",
  description: "See prices and timings for cuts, skin fades and beard trims with Sean, Travis and Dylan at Symmetry Barbers in Saundersfoot.",
  alternates: { canonical: "/prices" },
  openGraph: {
    title: "Barber Prices | Symmetry Saundersfoot",
    description: "Prices and timings for cuts, skin fades and beard trims with Sean, Travis and Dylan.",
    url: "/prices",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Barber Prices | Symmetry Saundersfoot",
    description: "Cuts, fades and beard trims with Sean, Travis and Dylan.",
  },
};

export default async function PricesPage() {
  const {services:SERVICES} = await getCatalog();
  return (
    <main className="information-page">
      <BrandHeader />
      <section className="information-hero">
        <p className="eyebrow">cuts, fades and beards</p>
        <h1>prices.</h1>
        <p>Choose your barber to see their prices and timings.</p>
      </section>
      <section className="price-columns">
        {Object.entries(BARBERS).map(([id, barber]) => (
          <article className="price-column" key={id}>
            <header>
              <h2>{barber.name}</h2>
              <p>{barber.role}</p>
            </header>
            {SERVICES.map((service) => {
              const detail = service.barbers[id as keyof typeof BARBERS];
              if(!detail) return null;
              return (
                <div className="price-row" key={service.id}>
                  <div><h3>{service.name}</h3><small>{detail.duration} min</small></div>
                  <strong>£{money(detail.price)}</strong>
                </div>
              );
            })}
            <Link className="primary-button" href={`/book?barber=${id}`}>book with {barber.name}</Link>
          </article>
        ))}
      </section>
      <SiteFooter />
    </main>
  );
}
