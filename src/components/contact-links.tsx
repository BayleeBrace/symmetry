import { shopContact } from "@/lib/shop-contact";
export function ContactLinks({ fallback = false }: { fallback?: boolean }) {
  if (!shopContact.phone && !shopContact.email)
    return fallback ? (
      <p>
        Speak to us in the shop at 4 Brewery Terrace, Saundersfoot, SA69 9HG, or{" "}
        <a href="https://www.instagram.com/symmetry.wales/">
          message us on Instagram
        </a>
        .
      </p>
    ) : null;
  return (
    <div className="contact-links">
      {shopContact.phone && (
        <a href={`tel:${shopContact.phone.replace(/[^+\d]/g, "")}`}>
          {shopContact.phone}
        </a>
      )}
      {shopContact.email && (
        <a href={`mailto:${shopContact.email}`}>{shopContact.email}</a>
      )}
    </div>
  );
}
