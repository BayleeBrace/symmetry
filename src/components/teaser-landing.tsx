"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

export function TeaserLanding() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/site-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setMessage(
          response.status === 429
            ? "Too many attempts. Please wait a few minutes."
            : response.status === 401
              ? "That password isn’t quite right."
              : "Preview access isn’t available yet.",
        );
        return;
      }

      window.location.reload();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="teaser-page">
      <Image
        className="teaser-background"
        src="/images/shop-hero.jpg"
        alt=""
        fill
        priority
        quality={85}
        sizes="100vw"
      />
      <div className="teaser-overlay" />

      <div className="teaser-content">
        <header className="teaser-brand">
          <Image
            className="full-mark"
            src="/symmetry-wordmark.svg"
            alt="Symmetry"
            width={264}
            height={38}
            priority
          />

          <Image
            className="monogram"
            src="/symmetry-monogram.svg"
            width={44}
            height={44}
            alt="Symmetry"
          />
        </header>

        <div className="teaser-message">
          <p className="eyebrow">Coming soon</p>
          <h1>
            Same chairs.
            <br />
            New name.
          </h1>
        </div>

        <form className="teaser-form" onSubmit={unlock}>
          <label htmlFor="site-password">Preview the new site</label>
          <div>
            <input
              id="site-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Opening…" : "Enter"}
            </button>
          </div>
          <p className="teaser-form-message" aria-live="polite">
            {message}
          </p>
        </form>
      </div>
    </main>
  );
}
