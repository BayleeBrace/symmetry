import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";
export default function NotFound() {
  return (
    <main className="information-page">
      <BrandHeader />
      <section className="information-hero">
        <p className="eyebrow">page not found</p>
        <h1>wrong chair.</h1>
        <p>That page isn’t here. Let’s get you back to the shop.</p>
        <div className="hero-actions">
          <Link className="primary-button" href="/">
            home
          </Link>
          <Link className="quiet-button" href="/book">
            book a trim
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
