"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function BrandHeader({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = [
    ["home", "/"],
    ["prices", "/prices"],
    ["hours", "/hours"],
    ["book", "/book"],
    ["your bookings", "/bookings"],
  ];

  return (
    <header className={`brand-header ${compact ? "compact" : ""}`}>
      <Link href="/" className="wordmark" aria-label="Symmetry home">
        <Image src="/symmetry-wordmark.svg" width={264} height={38} alt="Symmetry" priority />
        <small>BARBERS · SAUNDERSFOOT</small>
      </Link>
      <button
        className="menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "close" : "menu"}
      </button>
      <nav id="main-navigation" className={open ? "open" : ""} aria-label="Main navigation">
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
