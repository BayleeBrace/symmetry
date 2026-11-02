export const runtime = "nodejs";
import { createBrandedOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const alt = "Prices for cuts, fades and beard trims at Symmetry Barbers";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/jpeg";

export default function OpenGraphImage() {
  return createBrandedOgImage({
    eyebrow: "cuts, fades and beards",
    title: "prices.",
    detail: "Sean · Travis · Dylan",
  });
}
