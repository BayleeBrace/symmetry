import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-mark" aria-hidden="true">SY</p>
        <h2>diolch.</h2>
        <p>thank you.</p>
      </div>
      <div className="footer-links">
        <Link className="primary-button light" href="/book">book a trim</Link>
        <p>symmetry, saundersfoot<br />formerly studio 4 barbers.</p>
        <a href="https://www.instagram.com/symmetry.wales/" target="_blank" rel="noreferrer">@symmetry.wales</a>
        <Link href="/staff">staff sign in</Link>
      </div>
    </footer>
  );
}
