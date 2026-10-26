
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import catalogue from "@/data/catalogue-import.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatalogueVariant = {
  id: string;
  sku: string;
  variantType?: "SIZE" | "COLOR" | "SIZE_COLOR" | "CUSTOM";
  name: string;
  size?: string;
  color?: string;
  value?: string;
  price: number;
  mrp?: number;
  stock: number;
  status?: "active" | "inactive" | "out_of_stock";
  images?: string[];
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

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function verifyAdmin(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(
      header.slice(7).trim()
    );

    const snapshot = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .get();

    if (!snapshot.exists) return null;

    const user = snapshot.data() ?? {};
    const role = String(user.role ?? "").toLowerCase();
    const status = String(
      user.accountStatus ?? user.status ?? ""
    ).toLowerCase();

    const isAdmin =
      ["admin", "superadmin"].includes(role) ||
      decoded.admin === true;

    if (!isAdmin) return null;

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

function validateItem(item: CatalogueItem) {
  if (
    !item.name?.trim() ||
    !item.slug?.trim() ||
    !item.categoryName?.trim()
  ) {
    throw new Error("Product name, slug and category are required.");
  }

  if (
    !Number.isFinite(item.retailPrice) ||
    item.retailPrice <= 0 ||
    !Number.isFinite(item.wholesalePrice) ||
    item.wholesalePrice <= 0
  ) {
    throw new Error(`Invalid price for ${item.name}.`);
  }

  if (!Number.isInteger(item.moq) || item.moq < 1) {
    throw new Error(`Invalid MOQ for ${item.name}.`);
  }

  if (!Array.isArray(item.images) || item.images.length === 0) {
    throw new Error(`Images are missing for ${item.name}.`);
  }

  if (!Array.isArray(item.variants) || item.variants.length === 0) {
    throw new Error(`Variants are missing for ${item.name}.`);
  }

  const variantIds = new Set<string>();
  const variantSkus = new Set<string>();

  for (const variant of item.variants) {
    if (!variant.id?.trim() || !variant.sku?.trim()) {
      throw new Error(`Variant ID/SKU missing in ${item.name}.`);
    }

    if (
      variantIds.has(variant.id) ||
      variantSkus.has(variant.sku)
    ) {
      throw new Error(`Duplicate variant ID/SKU in ${item.name}.`);
    }

    variantIds.add(variant.id);
    variantSkus.add(variant.sku);

    if (!Number.isFinite(variant.price) || variant.price <= 0) {
      throw new Error(`Invalid variant price in ${item.name}.`);
    }

    if (!Number.isInteger(variant.stock) || variant.stock < 0) {
      throw new Error(`Invalid variant stock in ${item.name}.`);
    }
  }

  const calculatedStock = item.variants.reduce(
    (sum, variant) => sum + variant.stock,
    0
  );

  if (item.stock !== calculatedStock) {
    throw new Error(
      `Stock mismatch for ${item.name}: product stock is ${item.stock}, ` +
      `but variant total is ${calculatedStock}.`
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);

  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Valid admin login required." },
      { status: 401 }
    );
  }

  try {
    if (!Array.isArray(catalogueItems) || catalogueItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Catalogue is empty or invalid." },
        { status: 400 }
      );
    }

    const seenSlugs = new Set<string>();

    for (const item of catalogueItems) {
      validateItem(item);

      const slug = makeSlug(item.slug);

      if (seenSlugs.has(slug)) {
        throw new Error(`Duplicate product slug: ${item.slug}`);
      }

      seenSlugs.add(slug);
    }

    const categoryIds: Record<string, string> = {};

    for (const item of catalogueItems) {
      const categoryName = item.categoryName;

      if (categoryIds[categoryName]) continue;

      const categorySlug = makeSlug(categoryName);

      const existing = await adminDb
        .collection("categories")
        .where("slug", "==", categorySlug)
        .limit(1)
        .get();

      if (!existing.empty) {
        categoryIds[categoryName] = existing.docs[0].id;
        continue;
      }

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

    const results: Array<{
      slug: string;
      productId: string;
      action: "created" | "updated";
      stock: number;
      status: "draft";
    }> = [];

    for (const item of catalogueItems) {
      const existing = await adminDb
        .collection("products")
        .where("slug", "==", item.slug)
        .limit(1)
        .get();

      const isNew = existing.empty;
      const productRef = isNew
        ? adminDb.collection("products").doc()
        : existing.docs[0].ref;

      const oldData = isNew ? {} : existing.docs[0].data();

      const variants = item.variants.map((variant) => ({
        ...variant,
        variantType:
          variant.variantType ??
          (variant.size && variant.color
            ? "SIZE_COLOR"
            : variant.size
              ? "SIZE"
              : variant.color
                ? "COLOR"
                : "CUSTOM"),
        status:
          variant.stock > 0 ? "inactive" as const : "out_of_stock" as const,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
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

      const totalStock = variants.reduce(
        (sum, variant) => sum + variant.stock,
        0
      );

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
          type:
            sizes.length > 0 && colors.length > 0
              ? "SIZE_COLOR"
              : sizes.length > 0
                ? "SIZE"
                : colors.length > 0
                  ? "COLOR"
                  : "CUSTOM",
          sizes,
          colors,
          variants,
        },

        stock: totalStock,

        // Imported products require admin review before publication.
        status: "draft",
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
        stock: totalStock,
        status: "draft",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Catalogue imported as drafts. Review before publishing.",
      productsProcessed: results.length,
      variantsProcessed: catalogueItems.reduce(
        (total, item) => total + item.variants.length,
        0
      ),
      totalVariantStock: results.reduce(
        (total, item) => total + item.stock,
        0
      ),
      results,
      warning:
        "All imported products and variants are non-purchasable until reviewed and activated.",
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
