import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/bookings", "/staff"],
    },
    sitemap: "https://symmetrywales.com/sitemap.xml",
    host: "https://symmetrywales.com",
  };
}
