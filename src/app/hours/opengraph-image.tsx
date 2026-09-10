export const runtime = "nodejs";
import { createBrandedOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const alt =
  "Opening hours and location for Symmetry Barbers in Saundersfoot";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/jpeg";

export default function OpenGraphImage() {
  return createBrandedOgImage({
    eyebrow: "saundersfoot, pembrokeshire",
    title: "come by.",
    detail: "4 Brewery Terrace · Saundersfoot · SA69 9HG",
  });
}
