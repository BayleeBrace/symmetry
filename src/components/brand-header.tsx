"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
export function BrandHeader({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const links = [
    ["Prices", "/prices"],
    ["Hours", "/hours"],
    ["Book", "/book"],
    ["Your bookings", "/bookings"],
  ];
  return (
    <>
      <header className={`brand-header ${compact ? "compact" : ""}`}>
        <Link href="/" className="wordmark" aria-label="Symmetry home">
          <Image
            className="full-mark"
            src={
              compact
                ? "/symmetry-wordmark-black.svg"
                : "/symmetry-wordmark.svg"
            }
            width={264}
            height={38}
            alt="Symmetry"
            priority
          />
          <Image
            className="monogram"
            src={
              compact
                ? "/symmetry-monogram-black.svg"
                : "/symmetry-monogram.svg"
            }
            width={44}
            height={44}
            alt="Symmetry"
          />
        </Link>
        {compact ? (
          <Link href="/" className="back-to-site">
            Back to the site
          </Link>
        ) : (
          <>
            <button
              className="menu-toggle"
              type="button"
              aria-expanded={open}
              aria-controls="main-navigation"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Close" : "Menu"}
            </button>
            <nav
              id="main-navigation"
              className={open ? "open" : ""}
              aria-label="Main navigation"
            >
              {links.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className={path === href ? "active" : ""}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </>
        )}
      </header>
      <span id="main-content" tabIndex={-1} className="skip-target" />
    </>
  );
}
