
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import catalogue from "@/data/catalogue-import.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    if (
      !["admin", "superadmin"].includes(role) &&
      decoded.admin !== true
    ) {
      return null;
    }

    const status = String(
      user.accountStatus ?? user.status ?? ""
    ).toLowerCase();

    if (["blocked", "suspended", "disabled"].includes(status)) {
      return null;
    }

    return { uid: decoded.uid };
  } catch {
    return null;
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
    const results: Array<{
      slug: string;
      productId: string;
      action: "created" | "updated";
    }> = [];

    const categoryIds: Record<string, string> = {};

    // Find existing categories before creating new ones.
    for (const item of catalogue) {
      const categoryName = item.categoryName;

      if (categoryIds[categoryName]) continue;

      const categorySlug = categoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const existingCategory = await adminDb
        .collection("categories")
        .where("slug", "==", categorySlug)
        .limit(1)
        .get();

      if (!existingCategory.empty) {
        categoryIds[categoryName] = existingCategory.docs[0].id;
      } else {
        const categoryRef = adminDb
          .collection("categories")
          .doc(categorySlug);

        await categoryRef.set(
          {
            name: categoryName,
            slug: categorySlug,
            description: `${categoryName} products`,
            status: "active",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        categoryIds[categoryName] = categoryRef.id;
      }
    }

    // Upsert products by slug to avoid duplicate catalogue entries.
    for (const item of catalogue) {
      if (!item.slug || !item.name) {
        throw new Error("A catalogue item is missing its name or slug.");
      }

      const existingProduct = await adminDb
        .collection("products")
        .where("slug", "==", item.slug)
        .limit(1)
        .get();

      const isNew = existingProduct.empty;
      const productRef = isNew
        ? adminDb.collection("products").doc()
        : existingProduct.docs[0].ref;

      const oldData = isNew ? {} : existingProduct.docs[0].data();

      const variants = item.variants.map((variant) => ({
        ...variant,
        status: variant.status || "active",
      }));

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

        variantConfiguration: {
          enabled: true,
          type: "SIZE_COLOR",
          sizes: [...new Set(variants.map((v) => v.size).filter(Boolean))],
          colors: [...new Set(variants.map((v) => v.color).filter(Boolean))],
          variants,
        },

        stock: item.stock,
        status: "active",
        featured: false,
        bestSeller: false,
        trending: false,
        skuGroup: item.skuGroup,
        design: item.design,

        createdAt: oldData.createdAt ?? FieldValue.serverTimestamp(),
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
      variantsProcessed: catalogue.reduce(
        (total, item) => total + item.variants.length,
        0
      ),
      results,
      warning:
        "Verify product images, category mapping and physical stock before accepting fulfilment.",
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
