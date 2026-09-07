"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function MobileBookCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const button = document.getElementById("hero-book-button");
    if (!button || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShow(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
    });
    observer.observe(button);
    return () => observer.disconnect();
  }, []);
  return show ? (
    <Link className="mobile-book-cta" href="/book">
      book a trim
    </Link>
  ) : null;
}
