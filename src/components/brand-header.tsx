import Image from "next/image";
import Link from "next/link";

/**
 * The header on the booking, bookings and waitlist pages: the wordmark black
 * on white (Edition 01, page 20), with a way back to the site on wider
 * screens. The public pages use SiteHeader instead.
 */
export function BrandHeader() {
  return (
    <>
      <header className="brand-header compact">
        <Link href="/" className="wordmark" aria-label="Symmetry home">
          <Image
            className="full-mark"
            src="/symmetry-wordmark-black.svg"
            width={264}
            height={38}
            alt="Symmetry"
            priority
          />
          <Image
            className="monogram"
            src="/symmetry-monogram-black.svg"
            width={44}
            height={44}
            alt="Symmetry"
          />
        </Link>
        {/* Nothing sits beside the wordmark in its clear space. */}
        <Link href="/" className="back-to-site">
          Back to the site
        </Link>
      </header>
      <span id="main-content" tabIndex={-1} className="skip-target" />
    </>
  );
}
