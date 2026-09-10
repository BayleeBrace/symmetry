"use client";
import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="information-page">
      <BrandHeader />
      <section className="information-hero">
        <p className="eyebrow">a little interruption</p>
        <h1>one moment.</h1>
        <p>We couldn’t load this page. Try again in a moment.</p>
        <p>
          If you were saving your card, check your bookings before starting
          another trim.
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => retry()}>
            try again
          </button>
          <Link className="quiet-button" href="/bookings">
            your bookings
          </Link>
          <Link className="text-link" href="/">
            back to shop
          </Link>
        </div>
      </section>
      <footer className="site-footer">
        <h2>diolch.</h2>
        <Link href="/privacy">privacy</Link>
      </footer>
    </main>
  );
}
