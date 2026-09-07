import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Symmetry Barbers",
    short_name: "Symmetry",
    description: "Book and manage your trims at Symmetry, Saundersfoot.",
    start_url: "/",
    display: "standalone",
    background_color: "#efebe3",
    theme_color: "#161616",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
