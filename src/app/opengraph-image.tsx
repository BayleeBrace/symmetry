export const runtime = "nodejs";
import { createBrandedOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const alt = "Symmetry Barbers in Saundersfoot — same chairs, new name";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/jpeg";

export default async function OpenGraphImage() {
  return createBrandedOgImage({
    eyebrow:
      process.env.SITE_LIVE === "true"
        ? "barbers in Saundersfoot"
        : "coming soon",
    title: "same chairs.\nnew name.",
    detail: "cuts, fades and beards in Saundersfoot.",
  });
}
