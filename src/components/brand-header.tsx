import Image from "next/image";
import Link from "next/link";

export function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`brand-header ${compact ? "compact" : ""}`}>
      <Link href="/" className="wordmark" aria-label="Symmetry home">
        <Image src="/symmetry-wordmark.svg" width={264} height={38} alt="Symmetry" priority />
        <small>BARBERS · SAUNDERSFOOT</small>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/book">book a trim</Link>
        <Link href="/staff">for the lads</Link>
      </nav>
    </header>
  );
}
