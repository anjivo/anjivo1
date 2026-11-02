
import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase-admin";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

type ProductSEO = {
  name?: string;
  slug?: string;
  description?: string;
  images?: string[];
  status?: string;
};

function readableProductName(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;

  const fallbackName = readableProductName(slug);
  const canonicalUrl = `https://anjivo.online/products/${encodeURIComponent(slug)}`;

  try {
    const db = getAdminDb();

    const snapshot = await db
      .collection("products")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        title: `${fallbackName} | ANJIVO`,
        description: `Explore ${fallbackName} on ANJIVO. Discover products and online shopping options.`,
        alternates: {
          canonical: canonicalUrl,
        },
      };
    }

    const product = snapshot.docs[0].data() as ProductSEO;

    if (
      product.status !== "active" &&
      product.status !== "ACTIVE"
    ) {
      return {
        title: "Product Not Available | ANJIVO",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const name = product.name?.trim() || fallbackName;

    const description =
      product.description?.trim().slice(0, 160) ||
      `Buy ${name} online from ANJIVO. Explore product details and available options.`;

    const image =
      Array.isArray(product.images) && product.images.length > 0
        ? product.images[0]
        : undefined;

    return {
      title: `${name} Online | ANJIVO`,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        type: "website",
        url: canonicalUrl,
        siteName: "ANJIVO",
        title: `${name} Online | ANJIVO`,
        description,
        ...(image ? { images: [{ url: image, alt: name }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: `${name} Online | ANJIVO`,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch (error) {
    console.error("Product SEO metadata error:", error);

    return {
      title: `${fallbackName} | ANJIVO`,
      description: `Explore ${fallbackName} on ANJIVO.`,
      alternates: {
        canonical: canonicalUrl,
      },
    };
  }
}

export default function ProductSlugLayout({ children }: Props) {
  return children;
}
