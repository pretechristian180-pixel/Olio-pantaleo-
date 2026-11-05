import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Indicizzate solo le pagine pubbliche; area cliente, admin e API no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/registrati", "/accedi", "/termini", "/privacy", "/cookie"],
      disallow: [
        "/api/",
        "/admin",
        "/inizio",
        "/script",
        "/video",
        "/calendario",
        "/brand",
        "/social",
        "/piano",
        "/team",
        "/onboarding",
        "/invito",
        "/design-system",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
