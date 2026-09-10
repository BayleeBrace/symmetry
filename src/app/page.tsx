import { showFormerly, shopDescription } from "@/lib/brand-copy";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BrandHeader } from "@/components/brand-header";
import { MobileBookCta } from "@/components/mobile-book-cta";
import { ContactLinks } from "@/components/contact-links";
import { OpeningHours } from "@/components/opening-hours";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { TeaserLanding } from "@/components/teaser-landing";
import { getCatalog } from "@/lib/catalog";
import { BARBERS } from "@/lib/booking-data";
import { hasSiteAccess, SITE_ACCESS_COOKIE } from "@/lib/site-access";

export function generateMetadata(): Metadata {
  const description =
    process.env.SITE_LIVE === "true"
      ? shopDescription()
      : "Symmetry Barbers is coming soon to Saundersfoot, Pembrokeshire. Formerly Studio 4 Barbers. Same chairs. New name.";
  return {
    title: { absolute: "Symmetry Barbers Saundersfoot | Cuts, Fades & Beards" },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      title: "Symmetry Barbers Saundersfoot",
      description,
      url: "/",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Symmetry Barbers Saundersfoot",
      description,
    },
  };
}

export default async function Home() {
  const cookieStore = await cookies();
  const isUnlocked = await hasSiteAccess(
    cookieStore.get(SITE_ACCESS_COOKIE)?.value,
  );

  if (!isUnlocked) {
    return <TeaserLanding />;
  }

  const catalog = await getCatalog();
  return (
    <main className="marketing-home">
      <BrandHeader />
      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p className="eyebrow">Barbers in Saundersfoot</p>
          <h1>
            Same chairs.
            <br />
            New name.
          </h1>
          <p className="hero-intro subhead">
            Cuts, fades and beards.
            {showFormerly() && (
              <span className="former-line">Formerly Studio 4 Barbers.</span>
            )}
          </p>
          <div className="hero-actions">
            <Link
              id="hero-book-button"
              className="primary-button light"
              href="/book"
            >
              Book a trim
            </Link>
            <Link className="text-link light-link" href="/prices">
              View prices
            </Link>
          </div>
          <p className="hero-address">4 Brewery Terrace, Saundersfoot.</p>
        </div>
        <figure className="marketing-hero-image cut-photo">
          <Image
            className="upper"
            src="/images/shop-hero.jpg"
            alt="The barber chairs and illuminated mirrors inside Symmetry Barbers in Saundersfoot"
            fill
            priority
            quality={85}
            sizes="100vw"
          />
          <Image
            className="lower"
            src="/images/shop-hero.jpg"
            alt=""
            aria-hidden="true"
            fill
            priority
            quality={85}
            sizes="100vw"
          />
        </figure>
      </section>

      <section className="barbers-section">
        <Reveal className="section-heading">
          <p className="eyebrow">The shop</p>
          <h2>Your chair.</h2>
          <p>Three barbers. Choose yours.</p>
        </Reveal>
        <div className="barber-list">
          {Object.entries(BARBERS).map(([id, barber]) => (
            <Reveal className="barber-card" key={id}>
              <div className="barber-copy">
                <h3>{barber.name}</h3>
                <p>{barber.role}</p>
              </div>
              <Link className="text-link" href={`/book?barber=${id}`}>
                Book
              </Link>
            </Reveal>
          ))}
          <Reveal className="services-row">
            <span>Cuts, fades and beards.</span>
            <Link className="text-link" href="/prices">
              View prices
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="visit-section">
        <Reveal>
          <p className="eyebrow">Saundersfoot, Pembrokeshire</p>
          <h2>Croeso.</h2>
          <p>4 Brewery Terrace, Saundersfoot, SA69 9HG.</p>
          <p>Use the shared entrance and look for Symmetry inside.</p>
          <ContactLinks />
          <a
            className="text-link"
            href="https://maps.google.com/?q=4+Brewery+Terrace+Saundersfoot+SA69+9HG"
            target="_blank"
            rel="noreferrer"
          >
            Open in maps
          </a>
        </Reveal>
        <Reveal className="hours-list">
          <OpeningHours hours={catalog.hours} />
          <Link className="text-link" href="/hours">
            Opening hours
          </Link>
        </Reveal>
      </section>

      <SiteFooter />
      <MobileBookCta />
    </main>
  );
}
