import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date();
  const shopImage = "https://symmetrywales.com/images/shop-hero.jpg";

  if (process.env.SITE_LIVE !== "true")
    return [{ url: "https://symmetrywales.com/", lastModified: updated }];
  return [
    {
      url: "https://symmetrywales.com/privacy",
      lastModified: updated,
      priority: 0.3,
    },
    {
      url: "https://symmetrywales.com/cancellation-policy",
      lastModified: updated,
      priority: 0.3,
    },
    {
      url: "https://symmetrywales.com/",
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 1,
      images: [shopImage],
    },
    {
      url: "https://symmetrywales.com/prices",
      lastModified: updated,
      changeFrequency: "monthly",
      priority: 0.8,
      images: [shopImage],
    },
    {
      url: "https://symmetrywales.com/hours",
      lastModified: updated,
      changeFrequency: "monthly",
      priority: 0.8,
      images: [shopImage],
    },
  ];
}
