import Image from "next/image";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";

export default function Home() {
  return (
    <main>
      <section className="home-hero">
        <BrandHeader />
        <div className="home-copy">
          <p className="eyebrow">SAUNDERSFOOT, PEMBROKESHIRE</p>
          <h1>same chairs.<br />new name.</h1>
          <p>Three barbers. Cuts, fades and beards. Tuesday to Saturday.</p>
          <Link className="primary-button" href="/book">book a trim</Link>
        </div>
        <Image src="/images/shop.webp" alt="Inside Symmetry barbers in Saundersfoot" width={800} height={1067} priority sizes="(max-width: 760px) 100vw, 44vw" />
      </section>
      <section className="home-strip">
        <p className="eyebrow">THE APP</p>
        <h2>Your next trim,<br />without the faff.</h2>
        <p>Choose your barber—or take the first available chair. Book one date or your next few together.</p>
        <Link href="/book">try the booking flow →</Link>
      </section>
    </main>
  );
}
