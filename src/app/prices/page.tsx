export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";
import { getCatalog } from "@/lib/catalog";
import { BARBERS, money } from "@/lib/booking-data";

export const metadata: Metadata = {
  title: "Barber Prices in Saundersfoot",
  description:
    "See prices for cuts, skin fades and beard trims with Sean, Travis and Dylan at Symmetry Barbers in Saundersfoot.",
  alternates: { canonical: "/prices" },
  openGraph: {
    title: "Barber Prices | Symmetry Saundersfoot",
    description:
      "Prices for cuts, skin fades and beard trims with Sean, Travis and Dylan.",
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
  const { services: SERVICES } = await getCatalog();
  return (
    <main className="information-page">
      <BrandHeader />
      <section className="information-hero">
        <p className="eyebrow">Cuts, fades and beards</p>
        <h1>Prices.</h1>
        <p>Each barber sets their own prices.</p>
      </section>
      <section className="price-panel">
        <table className="brand-price-table">
          <caption className="sr-only">
            Service prices in pounds by barber
          </caption>
          <thead>
            <tr>
              <th scope="col">Service</th>
              {(["dylan", "travis", "sean"] as const).map((id) => (
                <th key={id} scope="col" aria-label={BARBERS[id].name}>
                  {id[0].toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((service) => (
              <tr key={service.id}>
                <th scope="row">{service.name}</th>
                {(["dylan", "travis", "sean"] as const).map((id) => (
                  <td key={id}>
                    {service.barbers[id] ? (
                      money(service.barbers[id].price)
                    ) : (
                      <span aria-label="Not offered">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="price-legend">D Dylan · T Travis · S Sean</p>
        <p className="price-note">Prices in pounds.</p>
        <div className="price-book-links">
          {(["dylan", "travis", "sean"] as const).map((id) => (
            <Link className="quiet-button" key={id} href={`/book?barber=${id}`}>
              Book with {BARBERS[id].name}
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
