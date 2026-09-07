import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date();
  return [
    { url: "https://symmetrywales.com/", lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: "https://symmetrywales.com/prices", lastModified: updated, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://symmetrywales.com/hours", lastModified: updated, changeFrequency: "monthly", priority: 0.7 },
  ];
}
