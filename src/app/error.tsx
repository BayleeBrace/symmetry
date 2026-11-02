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
        <p className="eyebrow">A little interruption</p>
        <h1>One moment.</h1>
        <p>We couldn’t load this page. Try again in a moment.</p>
        <p>
          If you were saving your card, check your bookings before starting
          another trim.
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => retry()}>
            Try again
          </button>
          <Link className="quiet-button" href="/bookings">
            Your bookings
          </Link>
          <Link className="text-link" href="/">
            Back to the shop
          </Link>
        </div>
      </section>
      <footer className="site-footer">
        <h2>Diolch.</h2>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
