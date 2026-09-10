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
        <h2>diolch.</h2>
        <p>thank you.</p>
      </div>
      <div className="footer-links">
        <Link className="primary-button light" href="/book">
          book a trim
        </Link>
        <p>
          symmetry, saundersfoot
          {showFormerly() && (
            <>
              <br />
              formerly studio 4 barbers.
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
        <Link href="/privacy">privacy</Link>
        <Link href="/cancellation-policy">cancellation policy</Link>
        <Link href="/staff">staff sign in</Link>
      </div>
    </footer>
  );
}
