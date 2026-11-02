import { getCatalog } from "@/lib/catalog";
import { openingStatus } from "@/lib/opening-status";
import { shopContact } from "@/lib/shop-contact";
import { SiteHeader, type OpenStatus } from "./site-header";

/**
 * The site header with what the menu shows filled in on the server: whether
 * the shop is open now (from the shop's own hours) and the contact details.
 */
export async function Header({ overPhoto = false }: { overPhoto?: boolean }) {
  let status: OpenStatus = null;
  try {
    const text = openingStatus((await getCatalog()).hours);
    status = { open: text.startsWith("Open today"), text };
  } catch {
    // Hours couldn't load: the menu simply leaves the status out.
  }
  return (
    <SiteHeader
      overPhoto={overPhoto}
      status={status}
      email={shopContact.email}
      phone={shopContact.phone}
    />
  );
}
