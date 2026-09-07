export const runtime = "nodejs";
import { createBrandedOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const alt = "Book a trim at Symmetry Barbers in Saundersfoot";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/jpeg";

export default function OpenGraphImage() {
  return createBrandedOgImage({
    eyebrow: "Book online",
    title: "Book a trim.",
    detail: "Choose your barber, service and time.",
  });
}
