import type { MetadataRoute } from "next";
import { products } from "@/lib/data/products";
import { recipes } from "@/lib/data/recipes";
import { articles } from "@/lib/data/magazine";

const baseUrl = "https://www.pantaleo.it";

const staticRoutes = [
  "",
  "/storia",
  "/la-puglia",
  "/prodotti",
  "/trova-il-tuo-olio",
  "/cucina",
  "/magazine",
  "/aziende",
  "/carrello",
  "/account",
  "/cerca",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.7,
    })),
    ...products.map((p) => ({
      url: `${baseUrl}/prodotti/${p.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...recipes.map((r) => ({
      url: `${baseUrl}/cucina/${r.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...articles.map((a) => ({
      url: `${baseUrl}/magazine/${a.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
