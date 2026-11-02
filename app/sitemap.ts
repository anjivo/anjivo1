
import type { MetadataRoute } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

const SITE_URL = "https://anjivo.online";

export const revalidate = 3600;

type SitemapDocument = {
  slug?: unknown;
  status?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
};

function getLastModified(data: SitemapDocument): Date {
  const timestamp = data.updatedAt ?? data.createdAt;

  if (
    timestamp &&
    typeof timestamp === "object" &&
    "toDate" in timestamp &&
    typeof timestamp.toDate === "function"
  ) {
    const date = timestamp.toDate();

    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
}

function getSlug(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/categories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/wholesale`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  try {
    const db = getAdminDb();

    const [categorySnapshot, productSnapshot] = await Promise.all([
      db.collection("categories").get(),
      db.collection("products").limit(10000).get(),
    ]);

    const categoryPages: MetadataRoute.Sitemap =
      categorySnapshot.docs
        .map((doc) => {
          const data = doc.data() as SitemapDocument;
          const slug = getSlug(data.slug);
          const status =
            typeof data.status === "string"
              ? data.status.toLowerCase()
              : "active";

          if (!slug || status !== "active") {
            return null;
          }

          return {
            url: `${SITE_URL}/categories/${encodeURIComponent(slug)}`,
            lastModified: getLastModified(data),
            changeFrequency: "weekly" as const,
            priority: 0.7,
          };
        })
        .filter(
          (page): page is NonNullable<typeof page> => page !== null
        );

    const productPages: MetadataRoute.Sitemap =
      productSnapshot.docs
        .map((doc) => {
          const data = doc.data() as SitemapDocument;
          const slug = getSlug(data.slug);
          const status =
            typeof data.status === "string"
              ? data.status.toLowerCase()
              : "";

          if (!slug || status !== "active") {
            return null;
          }

          return {
            url: `${SITE_URL}/products/${encodeURIComponent(slug)}`,
            lastModified: getLastModified(data),
            changeFrequency: "daily" as const,
            priority: 0.8,
          };
        })
        .filter(
          (page): page is NonNullable<typeof page> => page !== null
        );

    return [
      ...staticPages,
      ...categoryPages,
      ...productPages,
    ];
  } catch (error) {
    console.error("ANJIVO sitemap generation failed:", error);
    return staticPages;
  }
}
