export const dynamic = "force-dynamic";
import { getCatalog } from "@/lib/catalog";
import { OpeningHours } from "@/components/opening-hours";
import { ContactLinks } from "@/components/contact-links";
import { openingStatus } from "@/lib/opening-status";
import type { Metadata } from "next";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Opening Hours & Location in Saundersfoot",
  description:
    "Find Symmetry Barbers at 4 Brewery Terrace, Saundersfoot. View our Tuesday to Saturday opening hours and get directions.",
  alternates: { canonical: "/hours" },
  openGraph: {
    title: "Opening Hours & Location | Symmetry Saundersfoot",
    description:
      "Find Symmetry Barbers at 4 Brewery Terrace, Saundersfoot. Open Tuesday to Saturday.",
    url: "/hours",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Opening Hours | Symmetry Saundersfoot",
    description: "4 Brewery Terrace, Saundersfoot. Open Tuesday to Saturday.",
  },
};

export default async function HoursPage() {
  const catalog = await getCatalog();

  return (
    <main className="information-page">
      <BrandHeader />
      <section className="hours-page-grid">
        <div>
          <p className="eyebrow">Saundersfoot, Pembrokeshire</p>
          <h1>Come by.</h1>
          <p>
            4 Brewery Terrace
            <br />
            Saundersfoot
            <br />
            SA69 9HG
          </p>
          <p className="opening-status">{openingStatus(catalog.hours)}</p>
          <h2 className="finding-title">Finding us.</h2>
          <p>
            Our entrance on Brewery Terrace is shared with two other shops. Come
            through and look for the Symmetry door inside.
          </p>
          <ContactLinks />
          <a
            className="text-link"
            href="https://maps.google.com/?q=4+Brewery+Terrace+Saundersfoot+SA69+9HG"
            target="_blank"
            rel="noreferrer"
          >
            Open in maps
          </a>
        </div>
        <div className="hours-list large">
          <OpeningHours hours={catalog.hours} />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
