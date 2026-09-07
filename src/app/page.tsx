import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BrandHeader } from "@/components/brand-header";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { TeaserLanding } from "@/components/teaser-landing";
import {getCatalog} from "@/lib/catalog";
import {clock} from "@/lib/booking-data";
import { BARBERS } from "@/lib/booking-data";
import { hasSiteAccess, SITE_ACCESS_COOKIE } from "@/lib/site-access";

export const metadata: Metadata = {
  title: "Symmetry Barbers Saundersfoot | Cuts, Fades & Beards",
  description: "Symmetry Barbers is coming soon to Saundersfoot, Pembrokeshire. The same three chairs, with a new name. Cuts, skin fades and beard trims.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Symmetry Barbers Saundersfoot",
    description: "Same chairs. New name. Cuts, fades and beards in Saundersfoot, Pembrokeshire.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Symmetry Barbers Saundersfoot",
    description: "Same chairs. New name. Cuts, fades and beards in Saundersfoot.",
  },
};

export default async function Home() {
  const cookieStore = await cookies();
  const isUnlocked = await hasSiteAccess(cookieStore.get(SITE_ACCESS_COOKIE)?.value);

  if (!isUnlocked) {
    return <TeaserLanding />;
  }

  const catalog=await getCatalog();
  return (
    <main className="marketing-home">
      <BrandHeader />
      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p className="eyebrow">barbers in saundersfoot</p>
          <h1>same chairs.<br />new name.</h1>
          <p className="hero-intro">cuts, fades and beards.<br />formerly studio 4 barbers.</p>
          <div className="hero-actions">
            <Link className="primary-button light" href="/book">book a trim</Link>
            <Link className="text-link light-link" href="/prices">view prices</Link>
          </div>
          <p className="hero-address">4 brewery terrace, saundersfoot.</p>
        </div>
        <figure className="marketing-hero-image">
          <Image src="/images/shop-hero.jpg" alt="The barber chairs and illuminated mirrors inside Symmetry Barbers in Saundersfoot" fill priority quality={88} sizes="(max-width: 760px) calc(100vw - 40px), 48vw" />
        </figure>
      </section>

      <section className="barbers-section">
        <Reveal className="section-heading">
          <p className="eyebrow">the shop</p>
          <h2>your chair.</h2>
          <p>three barbers. choose yours.</p>
        </Reveal>
        <div className="barber-list">
          {Object.entries(BARBERS).map(([id, barber]) => (
            <Reveal className="barber-card" key={id}>
              <div className="barber-monogram" aria-hidden="true">{barber.name[0]}</div>
              <div className="barber-copy">
                <h3>{barber.name}</h3>
                <p>{barber.role}</p>
                <small>portrait and a few words from {barber.name} coming soon.</small>
              </div>
              <Link className="text-link" href={`/book?barber=${id}`}>book</Link>
            </Reveal>
          ))}
          <Reveal className="services-row">
            <span>cuts, fades and beards.</span>
            <Link className="text-link" href="/prices">view prices</Link>
          </Reveal>
        </div>
      </section>

      <section className="visit-section">
        <Reveal>
          <p className="eyebrow">saundersfoot, pembrokeshire</p>
          <h2>see you here.</h2>
          <p>4 brewery terrace, saundersfoot, SA69 9HG.</p>
          <p>Use the shared entrance and look for Symmetry inside.</p>
          <a className="text-link" href="https://maps.google.com/?q=4+Brewery+Terrace+Saundersfoot+SA69+9HG" target="_blank" rel="noreferrer">open in maps</a>
        </Reveal>
        <Reveal className="hours-list">
          {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map((day,i)=>{const h=catalog.hours[(i+1)%7];return <div key={day}><span>{day}</span><time>{h?clock(h[0])+' — '+clock(h[1]):'closed'}</time></div>;})}
          <Link className="text-link" href="/hours">opening hours</Link>
        </Reveal>
      </section>

      <SiteFooter />
      <Link className="mobile-book-cta" href="/book">book a trim</Link>
    </main>
  );
}
