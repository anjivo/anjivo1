
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { generateListing } from "@/lib/ai/listing-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PRODUCTS = 10;
const MAX_IMAGES_PER_PRODUCT = 10;

type BulkProductInput = {
  images: string[];
  productName?: string;
  category?: string;
  brand?: string;
  language?: string;
};

type BulkRequestBody = {
  products?: BulkProductInput[];
  sellerId?: string;
};

function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      [
        "firebasestorage.googleapis.com",
        "storage.googleapis.com",
      ].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Firebase authentication.
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const idToken = authorization.slice(7).trim();

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token." },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;

    // 2. Read role from trusted Firestore data.
    const userDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: "User profile not found." },
        { status: 403 }
      );
    }

    const userData = userDoc.data();
    const role = String(userData?.role ?? "").toLowerCase();

    const isAdmin =
      role === "admin" || decodedToken.admin === true;

    const isSeller =
      role === "seller" || role === "vendor";

    if (!isAdmin && !isSeller) {
      return NextResponse.json(
        {
          success: false,
          error: "Only sellers and admins can generate bulk listings.",
        },
        { status: 403 }
      );
    }

    // 3. Read request.
    let body: BulkRequestBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const products = body.products;

    if (
      !Array.isArray(products) ||
      products.length === 0 ||
      products.length > MAX_PRODUCTS
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Submit between 1 and ${MAX_PRODUCTS} products per request.`,
        },
        { status: 400 }
      );
    }

    // 4. Resolve seller identity.
    let sellerId = uid;

    if (isAdmin && body.sellerId) {
      sellerId = body.sellerId;
    }

    if (isSeller && body.sellerId && body.sellerId !== uid) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot generate listings for another seller.",
        },
        { status: 403 }
      );
    }

    const sellerDoc = await adminDb
      .collection("users")
      .doc(sellerId)
      .get();

    if (!sellerDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Seller account not found." },
        { status: 404 }
      );
    }

    const sellerData = sellerDoc.data();
    const sellerRole = String(sellerData?.role ?? "").toLowerCase();

    if (
      sellerId !== uid &&
      sellerRole !== "seller" &&
      sellerRole !== "vendor"
    ) {
      return NextResponse.json(
        { success: false, error: "Selected user is not a seller." },
        { status: 400 }
      );
    }

    if (
      sellerData?.status &&
      ["blocked", "suspended", "disabled"].includes(
        String(sellerData.status).toLowerCase()
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Seller account is not active." },
        { status: 403 }
      );
    }

    // 5. Validate all products before starting AI generation.
    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      if (
        !product ||
        !Array.isArray(product.images) ||
        product.images.length === 0 ||
        product.images.length > MAX_IMAGES_PER_PRODUCT
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Product ${i + 1}: upload 1 to ${MAX_IMAGES_PER_PRODUCT} images.`,
          },
          { status: 400 }
        );
      }

      if (
        !product.images.every(
          (image) =>
            typeof image === "string" &&
            image.length <= 4096 &&
            isValidImageUrl(image)
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Product ${i + 1}: invalid Firebase Storage image URL.`,
          },
          { status: 400 }
        );
      }
    }

    // 6. Generate each listing independently.
    const results = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      try {
        const listing = await generateListing({
          images: product.images,
          sellerId,
          productName:
            typeof product.productName === "string"
              ? product.productName.slice(0, 200)
              : undefined,
          category:
            typeof product.category === "string"
              ? product.category.slice(0, 100)
              : undefined,
          brand:
            typeof product.brand === "string"
              ? product.brand.slice(0, 100)
              : undefined,
          language:
            typeof product.language === "string"
              ? product.language.slice(0, 30)
              : "English",
        });

        results.push({
          index: i,
          success: true,
          listing,
        });
      } catch (error) {
        console.error(
          `Bulk listing generation failed for product ${i}:`,
          error
        );

        results.push({
          index: i,
          success: false,
          error: "AI generation failed for this product.",
        });
      }
    }

    // 7. Return results for review.
    const successCount = results.filter(
      (result) => result.success
    ).length;

    const failureCount = results.length - successCount;

    return NextResponse.json(
      {
        success: successCount > 0,
        message: "Bulk listing generation completed.",
        summary: {
          total: products.length,
          successful: successCount,
          failed: failureCount,
        },
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Bulk AI listing API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to process bulk listings. Please try again.",
      },
      { status: 500 }
    );
  }
}
