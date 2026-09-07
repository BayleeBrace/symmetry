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
        setMessage(response.status === 401 ? "That password isn’t quite right." : "Preview access isn’t available yet.");
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
    <main className="teaser-page">
      <Image
        className="teaser-background"
        src="/images/shop-hero.jpg"
        alt=""
        fill
        priority
        quality={92}
        sizes="100vw"
      />
      <div className="teaser-overlay" />

      <div className="teaser-content">
        <header className="teaser-brand">
          <Image src="/symmetry-wordmark.svg" alt="Symmetry" width={540} height={118} priority />
          <p>barbers · saundersfoot</p>
        </header>

        <div className="teaser-message">
          <p className="eyebrow">coming soon</p>
          <h1>same chairs.<br />new name.</h1>
        </div>

        <form className="teaser-form" onSubmit={unlock}>
          <label htmlFor="site-password">preview the new site</label>
          <div>
            <input
              id="site-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "opening…" : "enter"}
            </button>
          </div>
          <p className="teaser-form-message" aria-live="polite">{message}</p>
        </form>
      </div>
    </main>
  );
}
