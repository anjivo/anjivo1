
import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

type CategorySEO = {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  status?: string;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;

  const canonicalUrl = `https://anjivo.online/categories/${encodeURIComponent(slug)}`;

  try {
    const db = getAdminDb();

    const snapshot = await db
      .collection("categories")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        title: "Category Not Found | ANJIVO",
        robots: {
          index: false,
          follow: true,
        },
      };
    }

    const category = snapshot.docs[0].data() as CategorySEO;

    if (
      category.status &&
      category.status.toLowerCase() !== "active"
    ) {
      return {
        title: "Category Not Available | ANJIVO",
        robots: {
          index: false,
          follow: true,
        },
      };
    }

    const name = category.name?.trim() || "Shop Online";

    const description =
      category.description?.trim().slice(0, 160) ||
      `Explore ${name} products on ANJIVO. Discover products, compare options and shop online.`;

    const image = category.image?.trim();

    return {
      title: `${name} Online Shopping | ANJIVO`,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        type: "website",
        url: canonicalUrl,
        siteName: "ANJIVO",
        title: `${name} Online Shopping | ANJIVO`,
        description,
        ...(image ? { images: [{ url: image, alt: name }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: `${name} Online Shopping | ANJIVO`,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch (error) {
    console.error("Category SEO metadata error:", error);

    return {
      title: "Shop Categories Online | ANJIVO",
      description: "Explore different product categories on ANJIVO.",
      alternates: {
        canonical: canonicalUrl,
      },
    };
  }
}

export default function CategorySlugLayout({ children }: Props) {
  return children;
}
