
import type { MetadataRoute } from "next";

import { getCategories } from "@/lib/categories";
import { getProducts } from "@/lib/products";

const SITE_URL = "https://anjivo.online";

export const revalidate = 3600;

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
    const [categories, products] = await Promise.all([
      getCategories(),
      getProducts(10000),
    ]);

    const categoryPages: MetadataRoute.Sitemap = categories
      .filter((category) => category.slug?.trim())
      .map((category) => ({
        url: `${SITE_URL}/categories/${encodeURIComponent(category.slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      }));

    const productPages: MetadataRoute.Sitemap = products
      .filter(
        (product) =>
          product.status === "active" &&
          product.slug?.trim()
      )
      .map((product) => ({
        url: `${SITE_URL}/products/${encodeURIComponent(product.slug)}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      }));

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
