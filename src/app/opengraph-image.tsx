import { createBrandedOgImage, OG_IMAGE_SIZE } from "@/lib/og-image";

export const alt = "Symmetry Barbers in Saundersfoot — same chairs, new name";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return createBrandedOgImage({
    eyebrow: "coming soon",
    title: "same chairs.\nnew name.",
    detail: "Cuts, fades and beards in Saundersfoot.",
  });
}
