"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

const LINKS = [
  ["Prices", "/prices"],
  ["Hours", "/hours"],
  ["Book a trim", "/book"],
  ["Your bookings", "/bookings"],
] as const;

export type OpenStatus = { open: boolean; text: string } | null;

/**
 * The site header. At the top of the page it is one row: the wordmark and
 * "Menu" (on the home page it sits over the shop photo). As soon as the page
 * scrolls it becomes a slim black bar with the SY monogram, "Book a trim" and
 * "Menu". On wide screens the links sit in the bar instead of behind "Menu".
 * "Menu" opens a full-screen menu with the shop's open status and contacts.
 */
export function SiteHeader({
  overPhoto = false,
  status = null,
  email = "",
  phone = "",
}: {
  overPhoto?: boolean;
  status?: OpenStatus;
  email?: string;
  phone?: string;
}) {
  const [slim, setSlim] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => {
    const onScroll = () => setSlim(window.scrollY > 24);
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // While the menu is open: the page behind stays still, focus starts on the
  // first link, and Escape closes it and returns focus to "Menu".
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>(".site-menu-links a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep Tab inside the open menu.
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !menuRef.current) return;
    const items = [
      ...menuRef.current.querySelectorAll<HTMLElement>("a[href], button"),
    ];
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const close = () => setOpen(false);

  return (
    <>
      <header
        className={`site-header${overPhoto ? " over-photo" : ""}${slim ? " is-slim" : ""}`}
      >
        <Link href="/" className="site-home" aria-label="Symmetry home">
          <Image
            className="site-wordmark"
            src="/symmetry-wordmark.svg"
            width={264}
            height={38}
            alt=""
            priority
          />
          <Image
            className="site-monogram"
            src="/symmetry-monogram.svg"
            width={40}
            height={40}
            alt=""
          />
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          {LINKS.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : undefined}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="site-actions">
          <Link href="/book" className="site-book">
            Book a trim
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="site-menu-toggle"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
        </div>
      </header>
      {!overPhoto && <div className="site-header-spacer" aria-hidden="true" />}
      {open && (
        <div
          id="site-menu"
          ref={menuRef}
          className="site-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onKeyDown={trapFocus}
        >
          <div className="site-menu-bar">
            <Link
              href="/"
              className="site-home"
              aria-label="Symmetry home"
              onClick={close}
            >
              <Image
                className="site-wordmark"
                src="/symmetry-wordmark.svg"
                width={264}
                height={38}
                alt=""
              />
            </Link>
            <button
              type="button"
              className="site-menu-toggle"
              onClick={() => {
                close();
                toggleRef.current?.focus();
              }}
            >
              Close
            </button>
          </div>
          <nav className="site-menu-links" aria-label="Menu links">
            {LINKS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
                onClick={close}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="site-menu-foot">
            {status && (
              <>
                <p className="site-menu-welsh" lang="cy">
                  {status.open ? "Ar agor." : "Ar gau."}
                </p>
                <p className="site-menu-status">{status.text}</p>
              </>
            )}
            <p>4 Brewery Terrace, Saundersfoot, SA69 9HG.</p>
            <div className="site-menu-contacts">
              {phone && (
                <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>
              )}
              {email && <a href={`mailto:${email}`}>{email}</a>}
              <a
                href="https://www.instagram.com/symmetry.wales/"
                target="_blank"
                rel="noreferrer"
              >
                @symmetry.wales
              </a>
            </div>
          </div>
        </div>
      )}
      <span id="main-content" tabIndex={-1} className="skip-target" />
    </>
  );
}
