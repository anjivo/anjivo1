
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import catalogue from "@/data/catalogue-import.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatalogueVariant = {
  id: string;
  sku: string;
  variantType?: string;
  name: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
  status?: string;
};

type CatalogueItem = {
  skuGroup: string;
  name: string;
  design: string;
  categoryName: string;
  slug: string;
  description: string;
  retailPrice: number;
  wholesalePrice: number;
  moq: number;
  images: string[];
  variants: CatalogueVariant[];
  stock: number;
};

const catalogueItems = catalogue as CatalogueItem[];

async function verifyAdmin(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = header.slice(7).trim();
    const decoded = await adminAuth.verifyIdToken(token);

    const userSnapshot = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .get();

    if (!userSnapshot.exists) {
      return null;
    }

    const user = userSnapshot.data() ?? {};
    const role = String(user.role ?? "").toLowerCase();

    const isAdmin =
      ["admin", "superadmin"].includes(role) ||
      decoded.admin === true;

    if (!isAdmin) {
      return null;
    }

    const status = String(
      user.accountStatus ?? user.status ?? ""
    ).toLowerCase();

    if (
      ["blocked", "suspended", "disabled"].includes(status)
    ) {
      return null;
    }

    return { uid: decoded.uid };
  } catch (error) {
    console.error("[CATALOGUE IMPORT AUTH]", error);
    return null;
  }
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateCatalogueItem(item: CatalogueItem) {
  if (!item.name?.trim()) {
    throw new Error("A catalogue item is missing its name.");
  }

  if (!item.slug?.trim()) {
    throw new Error(`Product "${item.name}" is missing its slug.`);
  }

  if (!item.categoryName?.trim()) {
    throw new Error(
      `Product "${item.name}" is missing its category.`
    );
  }

  if (
    !Number.isFinite(item.retailPrice) ||
    item.retailPrice <= 0
  ) {
    throw new Error(
      `Invalid retail price for "${item.name}".`
    );
  }

  if (
    !Number.isFinite(item.wholesalePrice) ||
    item.wholesalePrice <= 0
  ) {
    throw new Error(
      `Invalid wholesale price for "${item.name}".`
    );
  }

  if (!Number.isInteger(item.moq) || item.moq < 1) {
    throw new Error(`Invalid wholesale MOQ for "${item.name}".`);
  }

  if (!Array.isArray(item.images) || item.images.length === 0) {
    throw new Error(`No images configured for "${item.name}".`);
  }

  if (!Array.isArray(item.variants) || item.variants.length === 0) {
    throw new Error(`No variants configured for "${item.name}".`);
  }

  for (const variant of item.variants) {
    if (!variant.id || !variant.sku) {
      throw new Error(
        `A variant in "${item.name}" is missing its ID or SKU.`
      );
    }

    if (
      !Number.isFinite(variant.price) ||
      variant.price <= 0
    ) {
      throw new Error(
        `Invalid variant price in "${item.name}".`
      );
    }

    if (
      !Number.isInteger(variant.stock) ||
      variant.stock < 0
    ) {
      throw new Error(
        `Invalid variant stock in "${item.name}".`
      );
    }
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);

  if (!admin) {
    return NextResponse.json(
      {
        success: false,
        error: "Valid admin login required.",
      },
      { status: 401 }
    );
  }

  try {
    if (!Array.isArray(catalogueItems) || catalogueItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Catalogue data is empty or invalid.",
        },
        { status: 400 }
      );
    }

    // Validate the complete catalogue before writing any products.
    const seenSlugs = new Set<string>();

    for (const item of catalogueItems) {
      validateCatalogueItem(item);

      const normalizedSlug = makeSlug(item.slug);

      if (seenSlugs.has(normalizedSlug)) {
        throw new Error(
          `Duplicate product slug found: ${item.slug}`
        );
      }

      seenSlugs.add(normalizedSlug);
    }

    const categoryIds: Record<string, string> = {};

    // Find or create categories.
    for (const item of catalogueItems) {
      const categoryName = item.categoryName;

      if (categoryIds[categoryName]) {
        continue;
      }

      const categorySlug = makeSlug(categoryName);

      const existingCategory = await adminDb
        .collection("categories")
        .where("slug", "==", categorySlug)
        .limit(1)
        .get();

      if (!existingCategory.empty) {
        categoryIds[categoryName] =
          existingCategory.docs[0].id;
      } else {
        const categoryRef = adminDb
          .collection("categories")
          .doc(categorySlug);

        await categoryRef.set(
          {
            name: categoryName,
            slug: categorySlug,
            description: `${categoryName} products on ANJIVO`,
            status: "active",
            productCount: 0,
            featured: false,
            trending: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        categoryIds[categoryName] = categoryRef.id;
      }
    }

    const results: Array<{
      slug: string;
      productId: string;
      action: "created" | "updated";
    }> = [];

    // Create or update products using their unique slugs.
    for (const item of catalogueItems) {
      const existingProduct = await adminDb
        .collection("products")
        .where("slug", "==", item.slug)
        .limit(1)
        .get();

      const isNew = existingProduct.empty;

      const productRef = isNew
        ? adminDb.collection("products").doc()
        : existingProduct.docs[0].ref;

      const oldData = isNew
        ? {}
        : existingProduct.docs[0].data();

      const variants = item.variants.map((variant) => ({
        ...variant,
        status: variant.status || "active",
      }));

      const sizes = [
        ...new Set(
          variants
            .map((variant) => variant.size)
            .filter((size): size is string => Boolean(size))
        ),
      ];

      const colors = [
        ...new Set(
          variants
            .map((variant) => variant.color)
            .filter((color): color is string => Boolean(color))
        ),
      ];

      const productData = {
        name: item.name,
        slug: item.slug,
        description: item.description,

        categoryId: categoryIds[item.categoryName],
        categoryName: item.categoryName,

        sellerId: admin.uid,
        sellerName: "ANJIVO Official",
        sellerVerified: true,

        images: item.images,

        mrp: item.retailPrice,
        retailPrice: item.retailPrice,
        wholesalePrice: item.wholesalePrice,
        moq: item.moq,

        wholesaleTiers: [
          {
            minQuantity: item.moq,
            price: item.wholesalePrice,
          },
        ],

        sellingMode: "BOTH",

        wholesaleConfiguration: {
          enabled: true,
          saleUnit: "PIECE",
          setBreakAllowed: true,
          priceUnit: "PIECE",
          tiers: [
            {
              minQuantity: item.moq,
              price: item.wholesalePrice,
            },
          ],
        },

        variantConfiguration: {
          enabled: true,
          type: "SIZE_COLOR",
          sizes,
          colors,
          variants,
        },

        stock: item.stock,

        status: "active",
        featured: false,
        bestSeller: false,
        trending: false,

        skuGroup: item.skuGroup,
        design: item.design,

        createdAt:
          oldData.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await productRef.set(productData, { merge: true });

      results.push({
        slug: item.slug,
        productId: productRef.id,
        action: isNew ? "created" : "updated",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Catalogue import completed.",
      productsProcessed: results.length,
      variantsProcessed: catalogueItems.reduce(
        (total, item) => total + item.variants.length,
        0
      ),
      results,
      warning:
        "Verify image-to-product mapping, physical stock, category compatibility, and checkout pricing before accepting customer orders.",
    });
  } catch (error) {
    console.error("[CATALOGUE IMPORT]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Catalogue import failed.",
      },
      { status: 500 }
    );
  }
}
