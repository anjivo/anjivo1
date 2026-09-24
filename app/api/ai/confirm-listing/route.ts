
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfirmListingBody = {
  listing?: Record<string, unknown>;
  sellerId?: string;
};

function cleanString(
  value: unknown,
  maxLength = 500
): string {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function isValidImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

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

function validPrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100000000
  );
}

function validStock(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 10000000
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Firebase ID token.
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(
        authorization.slice(7).trim()
      );
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token." },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;

    // 2. Verify role from trusted Firestore data.
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
          error: "Only sellers and admins can confirm listings.",
        },
        { status: 403 }
      );
    }

    // 3. Read request body.
    let body: ConfirmListingBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const listing = body.listing;

    if (!listing || typeof listing !== "object") {
      return NextResponse.json(
        { success: false, error: "Listing data is required." },
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
          error: "You cannot create listings for another seller.",
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

    // 5. Validate product fields.
    const title = cleanString(
      listing.title ?? listing.name,
      200
    );

    const description = cleanString(
      listing.description,
      5000
    );

    const category = cleanString(
      listing.category,
      100
    );

    if (!title || !description || !category) {
      return NextResponse.json(
        {
          success: false,
          error: "Title, description and category are required.",
        },
        { status: 400 }
      );
    }

    // 6. Validate product images.
    const rawImages = Array.isArray(listing.images)
      ? listing.images
      : Array.isArray(listing.imageUrls)
        ? listing.imageUrls
        : [];

    if (
      rawImages.length === 0 ||
      rawImages.length > 20 ||
      !rawImages.every(isValidImageUrl)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Provide 1 to 20 valid Firebase Storage image URLs.",
        },
        { status: 400 }
      );
    }

    // 7. Validate seller-confirmed price and stock.
    const price = listing.price;
    const stock = listing.stock;

    if (!validPrice(price) || !validStock(stock)) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid price and stock quantity before confirming.",
        },
        { status: 400 }
      );
    }

    // 8. Validate variants, if provided.
    const rawVariants = Array.isArray(listing.variants)
      ? listing.variants
      : [];

    if (rawVariants.length > 100) {
      return NextResponse.json(
        { success: false, error: "Maximum 100 variants allowed." },
        { status: 400 }
      );
    }

    const variants = [];

    for (let i = 0; i < rawVariants.length; i++) {
      const variant = rawVariants[i];

      if (!variant || typeof variant !== "object") {
        return NextResponse.json(
          { success: false, error: `Invalid variant ${i + 1}.` },
          { status: 400 }
        );
      }

      const v = variant as Record<string, unknown>;

      const variantPrice = v.price;
      const variantStock = v.stock;

      if (
        !validPrice(variantPrice) ||
        !validStock(variantStock)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Enter valid price and stock for variant ${i + 1}.`,
          },
          { status: 400 }
        );
      }

      variants.push({
        sku: cleanString(v.sku, 100),
        size: cleanString(v.size, 50),
        color: cleanString(v.color, 50),
        price: variantPrice,
        stock: variantStock,
      });
    }

    // 9. Build a clean product document.
    // Do not accept sellerId, status, createdAt or approval
    // flags from the client.
    const productData = {
      name: title,
      title,
      description,
      category,

      brand: cleanString(listing.brand, 100),

      price,
      stock,

      images: rawImages,
      imageUrls: rawImages,

      variants,

      keywords: Array.isArray(listing.keywords)
        ? listing.keywords
            .filter(
              (keyword): keyword is string =>
                typeof keyword === "string"
            )
            .slice(0, 30)
            .map((keyword) => keyword.slice(0, 100))
        : [],

      attributes:
        listing.attributes &&
        typeof listing.attributes === "object" &&
        !Array.isArray(listing.attributes)
          ? listing.attributes
          : {},

      sellerId,

      // Draft remains unpublished until separately approved.
      status: "pending_review",
      isPublished: false,
      isApproved: false,

      source: "ai_listing_studio",

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 10. Save product in Firestore.
    const productRef = await adminDb
      .collection("products")
      .add(productData);

    return NextResponse.json(
      {
        success: true,
        message: "Listing saved for review.",
        productId: productRef.id,
        status: "pending_review",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Confirm listing API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to save listing. Please try again.",
      },
      { status: 500 }
    );
  }
}
