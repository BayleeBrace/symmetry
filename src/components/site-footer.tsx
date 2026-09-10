import { showFormerly } from "@/lib/brand-copy";
import Link from "next/link";
import Image from "next/image";
import { ContactLinks } from "@/components/contact-links";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Image
          className="footer-wordmark"
          src="/symmetry-wordmark.svg"
          width={264}
          height={38}
          alt="Symmetry"
        />
        <h2>Diolch.</h2>
        <p>Thank you.</p>
      </div>
      <div className="footer-links">
        <Link className="primary-button light" href="/book">
          Book a trim
        </Link>
        <p>
          Symmetry, Saundersfoot
          {showFormerly() && (
            <>
              <br />
              Formerly Studio 4 Barbers.
            </>
          )}
        </p>
        <a
          href="https://www.instagram.com/symmetry.wales/"
          target="_blank"
          rel="noreferrer"
        >
          @symmetry.wales
        </a>
        <ContactLinks />
        <Link href="/privacy">Privacy</Link>
        <Link href="/cancellation-policy">Cancellation policy</Link>
        <Link href="/staff">Staff sign in</Link>
      </div>
    </footer>
  );
}
