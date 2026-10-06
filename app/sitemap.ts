import type { MetadataRoute } from "next";

const siteUrl = "https://acessounyflick.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      priority: 1,
    },
  ];
}