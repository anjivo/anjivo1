
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   ANJIVO AI LISTING CONFIRMATION API
   - Firebase authentication
   - Seller/admin authorization
   - Product validation
   - Seller-confirmed price and inventory
   - Secure Firestore document creation
   - Admin approval workflow
========================================================= */

type ConfirmListingBody = {
  listing?: Record<string, unknown>;
  sellerId?: string;
  confirmation?: Record<string, unknown>;
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 20;
const MAX_VARIANTS = 100;

const ALLOWED_IMAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function errorResponse(
  error: string,
  status: number,
  code?: string
) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(code ? { code } : {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function cleanString(
  value: unknown,
  maxLength = 500
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
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

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isValidImageUrl(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 4096
  ) {
    return false;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    if (
      !ALLOWED_IMAGE_HOSTS.has(
        url.hostname.toLowerCase()
      )
    ) {
      return false;
    }

    if (url.username || url.password) {
      return false;
    }

    const isFirebase =
      url.hostname ===
        "firebasestorage.googleapis.com" &&
      /^\/v0\/b\/[^/]+\/o\/.+/.test(url.pathname);

    const isGoogleStorage =
      url.hostname === "storage.googleapis.com" &&
      url.pathname.split("/").filter(Boolean).length >= 2;

    return isFirebase || isGoogleStorage;
  } catch {
    return false;
  }
}

function cleanStringArray(
  value: unknown,
  maxItems = 30,
  maxLength = 100
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) =>
          cleanString(item, maxLength)
        )
        .filter(Boolean)
    ),
  ].slice(0, maxItems);
}

function cleanAttributes(
  value: unknown
): Record<string, string> {
  if (!isObject(value)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (
    const [key, rawValue] of
    Object.entries(value).slice(0, 50)
  ) {
    const safeKey = cleanString(key, 100);

    if (!safeKey) {
      continue;
    }

    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      result[safeKey] = String(rawValue).slice(0, 300);
    }
  }

  return result;
}

/* =========================================================
   POST
========================================================= */

export async function POST(request: NextRequest) {
  try {
    /* 1. Request size */

    const contentLength =
      request.headers.get("content-length");

    if (
      contentLength &&
      Number(contentLength) > MAX_BODY_BYTES
    ) {
      return errorResponse(
        "Request body is too large.",
        413,
        "REQUEST_TOO_LARGE"
      );
    }

    /* 2. Firebase authentication */

    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return errorResponse(
        "Authentication required.",
        401,
        "UNAUTHORIZED"
      );
    }

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(
        authorization.slice(7).trim(),
        true
      );
    } catch {
      return errorResponse(
        "Invalid or expired authentication token.",
        401,
        "INVALID_TOKEN"
      );
    }

    const uid = decodedToken.uid;

    /* 3. Trusted user role */

    const userDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      return errorResponse(
        "User profile not found.",
        403,
        "USER_NOT_FOUND"
      );
    }

    const userData = userDoc.data();

    const role = String(
      userData?.role ?? ""
    ).toLowerCase();

    const isAdmin =
      role === "admin" ||
      decodedToken.admin === true;

    const isSeller =
      role === "seller" ||
      role === "vendor";

    if (!isAdmin && !isSeller) {
      return errorResponse(
        "Only sellers and admins can confirm listings.",
        403,
        "FORBIDDEN"
      );
    }

    if (
      userData?.status &&
      ["blocked", "suspended", "disabled"].includes(
        String(userData.status).toLowerCase()
      )
    ) {
      return errorResponse(
        "Your account is not active.",
        403,
        "ACCOUNT_INACTIVE"
      );
    }

    /* 4. Parse body */

    let body: ConfirmListingBody;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON request.",
        400,
        "INVALID_JSON"
      );
    }

    if (!isObject(body)) {
      return errorResponse(
        "Invalid request body.",
        400,
        "INVALID_BODY"
      );
    }

    const listing = body.listing;

    if (!isObject(listing)) {
      return errorResponse(
        "Listing data is required.",
        400,
        "LISTING_REQUIRED"
      );
    }

    /* 5. Resolve seller identity */

    let sellerId = uid;

    if (isAdmin && body.sellerId) {
      sellerId = cleanString(body.sellerId, 128);
    }

    if (
      isSeller &&
      body.sellerId &&
      body.sellerId !== uid
    ) {
      return errorResponse(
        "You cannot create listings for another seller.",
        403,
        "SELLER_OWNERSHIP_FAILED"
      );
    }

    if (!sellerId) {
      return errorResponse(
        "Invalid seller ID.",
        400,
        "INVALID_SELLER"
      );
    }

    const sellerDoc = await adminDb
      .collection("users")
      .doc(sellerId)
      .get();

    if (!sellerDoc.exists) {
      return errorResponse(
        "Seller account not found.",
        404,
        "SELLER_NOT_FOUND"
      );
    }

    const sellerData = sellerDoc.data();

    const sellerRole = String(
      sellerData?.role ?? ""
    ).toLowerCase();

    if (
      sellerId !== uid &&
      sellerRole !== "seller" &&
      sellerRole !== "vendor"
    ) {
      return errorResponse(
        "Selected user is not a seller.",
        400,
        "INVALID_SELLER"
      );
    }

    if (
      sellerData?.status &&
      ["blocked", "suspended", "disabled"].includes(
        String(sellerData.status).toLowerCase()
      )
    ) {
      return errorResponse(
        "Seller account is not active.",
        403,
        "SELLER_INACTIVE"
      );
    }

    /* 6. Product information */

    const title = cleanString(
      listing.title ?? listing.name,
      200
    );

    const description = cleanString(
      listing.description,
      12000
    );

    const shortDescription = cleanString(
      listing.shortDescription,
      500
    );

    const category = cleanString(
      listing.category,
      150
    );

    const subcategory = cleanString(
      listing.subcategory,
      150
    );

    const productType = cleanString(
      listing.productType,
      150
    );

    const brand = cleanString(
      listing.brand,
      150
    );

    if (!title || !description || !category) {
      return errorResponse(
        "Title, description and category are required.",
        400,
        "REQUIRED_FIELDS_MISSING"
      );
    }

    /* 7. Product images */

    const rawImages = Array.isArray(listing.images)
      ? listing.images
      : Array.isArray(listing.imageUrls)
        ? listing.imageUrls
        : [];

    if (
      rawImages.length === 0 ||
      rawImages.length > MAX_IMAGES ||
      !rawImages.every(isValidImageUrl)
    ) {
      return errorResponse(
        `Provide 1 to ${MAX_IMAGES} valid Firebase Storage image URLs.`,
        400,
        "INVALID_IMAGES"
      );
    }

    const imageUrls = [
      ...new Set(rawImages as string[]),
    ];

    /* 8. Seller-confirmed price and stock */

    // Support both old API fields and the upgraded
    // listing types' sellingPrice field.

    const price =
      listing.sellingPrice ?? listing.price;

    const stock = listing.stock;

    if (
      !validPrice(price) ||
      !validStock(stock)
    ) {
      return errorResponse(
        "Enter a valid seller-confirmed selling price and stock quantity.",
        400,
        "INVALID_PRICE_OR_STOCK"
      );
    }

    const wholesalePrice =
      listing.wholesalePrice ?? null;

    const mrp = listing.mrp ?? null;

    if (
      wholesalePrice !== null &&
      !validPrice(wholesalePrice)
    ) {
      return errorResponse(
        "Invalid wholesale price.",
        400,
        "INVALID_WHOLESALE_PRICE"
      );
    }

    if (
      mrp !== null &&
      !validPrice(mrp)
    ) {
      return errorResponse(
        "Invalid MRP.",
        400,
        "INVALID_MRP"
      );
    }

    /* 9. Product variants */

    const rawVariants = Array.isArray(listing.variants)
      ? listing.variants
      : [];

    if (rawVariants.length > MAX_VARIANTS) {
      return errorResponse(
        `Maximum ${MAX_VARIANTS} variants allowed.`,
        400,
        "TOO_MANY_VARIANTS"
      );
    }

    const variants: Record<string, unknown>[] = [];

    for (let i = 0; i < rawVariants.length; i++) {
      const rawVariant = rawVariants[i];

      if (!isObject(rawVariant)) {
        return errorResponse(
          `Invalid variant ${i + 1}.`,
          400,
          "INVALID_VARIANT"
        );
      }

      const variantPrice =
        rawVariant.sellingPrice ??
        rawVariant.price;

      const variantStock =
        rawVariant.stockQuantity ??
        rawVariant.stock;

      if (
        !validPrice(variantPrice) ||
        !validStock(variantStock)
      ) {
        return errorResponse(
          `Enter valid price and stock for variant ${i + 1}.`,
          400,
          "INVALID_VARIANT_PRICE_STOCK"
        );
      }

      const variantImages = Array.isArray(
        rawVariant.imageUrls
      )
        ? rawVariant.imageUrls
        : [];

      if (
        variantImages.length > MAX_IMAGES ||
        !variantImages.every(isValidImageUrl)
      ) {
        return errorResponse(
          `Invalid images for variant ${i + 1}.`,
          400,
          "INVALID_VARIANT_IMAGES"
        );
      }

      const variantWholesale =
        rawVariant.wholesalePrice ?? null;

      const variantMrp =
        rawVariant.mrp ?? null;

      if (
        variantWholesale !== null &&
        !validPrice(variantWholesale)
      ) {
        return errorResponse(
          `Invalid wholesale price for variant ${i + 1}.`,
          400,
          "INVALID_VARIANT_PRICE"
        );
      }

      if (
        variantMrp !== null &&
        !validPrice(variantMrp)
      ) {
        return errorResponse(
          `Invalid MRP for variant ${i + 1}.`,
          400,
          "INVALID_VARIANT_MRP"
        );
      }

      variants.push({
        id: cleanString(
          rawVariant.id,
          128
        ),

        sku: cleanString(
          rawVariant.sku,
          100
        ),

        barcode: cleanString(
          rawVariant.barcode,
          100
        ),

        size: cleanString(
          rawVariant.size,
          50
        ),

        color: cleanString(
          rawVariant.color,
          50
        ),

        attributes: cleanAttributes(
          rawVariant.attributes
        ),

        imageUrls: variantImages,

        sellingPrice: variantPrice,

        wholesalePrice: variantWholesale,

        mrp: variantMrp,

        stockQuantity: variantStock,

        isConfirmed: true,

        confirmedBy: uid,

        confirmedAt: new Date().toISOString(),
      });
    }

    /* 10. SEO and attributes */

    const rawSEO = isObject(listing.seo)
      ? listing.seo
      : {};

    const seo = {
      metaTitle: cleanString(
        rawSEO.metaTitle,
        70
      ),

      metaDescription: cleanString(
        rawSEO.metaDescription,
        200
      ),

      slug: cleanString(
        rawSEO.slug,
        200
      )
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 200),

      primaryKeyword: cleanString(
        rawSEO.primaryKeyword,
        100
      ),

      secondaryKeywords: cleanStringArray(
        rawSEO.secondaryKeywords,
        30,
        100
      ),

      searchTerms: cleanStringArray(
        rawSEO.searchTerms,
        30,
        100
      ),

      tags: cleanStringArray(
        rawSEO.tags,
        30,
        50
      ),

      isSellerConfirmed: true,
    };

    const keywords = cleanStringArray(
      listing.keywords ??
        listing.searchKeywords,
      30,
      100
    );

    const highlights = cleanStringArray(
      listing.highlights,
      10,
      300
    );

    const attributes = cleanAttributes(
      listing.attributes
    );

    /* 11. Compliance data */

    const hsnCode = cleanString(
      listing.hsnCode,
      20
    );

    const gstRate = listing.gstRate ?? null;

    if (
      gstRate !== null &&
      (
        typeof gstRate !== "number" ||
        !Number.isFinite(gstRate) ||
        gstRate < 0 ||
        gstRate > 100
      )
    ) {
      return errorResponse(
        "Invalid GST rate.",
        400,
        "INVALID_GST_RATE"
      );
    }

    const countryOfOrigin = cleanString(
      listing.countryOfOrigin,
      100
    );

    /* 12. Confirmation fields */

    const confirmation = isObject(
      body.confirmation
    )
      ? body.confirmation
      : {};

    const confirmedFields = cleanStringArray(
      confirmation.confirmedFields,
      100,
      100
    );

    const sellerConfirmed = true;

    const submitForApproval =
      confirmation.submitForApproval !== false;

    /*
     * Seller-confirmed listing:
     * pending_approval means awaiting admin review.
     *
     * Admin confirmation does not automatically publish
     * the product. Publication is handled separately.
     */

    const initialStatus = isAdmin
      ? "approved"
      : submitForApproval
        ? "pending_approval"
        : "draft";

    /* 13. Create clean Firestore document */

    const productData = {
      // Existing catalog compatibility
      name: title,
      title,
      description,
      shortDescription,
      category,
      subcategory,
      productType,
      brand,

      price,
      sellingPrice: price,
      wholesalePrice,
      mrp,
      stock,

      images: imageUrls,
      imageUrls,

      variants,

      keywords,
      searchKeywords: keywords,
      highlights,
      attributes,
      seo,

      // Compliance details
      hsnCode,
      gstRate,
      countryOfOrigin,

      // Identity
      sellerId,

      createdBy: uid,
      createdByRole: isAdmin
        ? "admin"
        : "seller",

      // Review status
      status: initialStatus,

      isPublished: false,
      isApproved: isAdmin,
      adminApproved: isAdmin,

      sellerConfirmed,
      sellerConfirmedBy: uid,

      confirmedFields,

      source: "ai_listing_studio",

      aiGenerated: true,

      // Keep these fields server-controlled.
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),

      ...(isAdmin
        ? {
            adminApprovedBy: uid,
            adminApprovedAt:
              FieldValue.serverTimestamp(),
          }
        : {}),
    };

    /* 14. Save listing */

    const productRef = adminDb
      .collection("products")
      .doc();

    await productRef.set(productData);

    /* 15. Return result */

    return NextResponse.json(
      {
        success: true,

        message: isAdmin
          ? "Listing saved and approved. It is not yet published."
          : submitForApproval
            ? "Listing submitted for admin approval."
            : "Listing saved as a draft.",

        productId: productRef.id,

        status: initialStatus,

        isPublished: false,

        sellerConfirmed: true,

        adminApproved: isAdmin,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "ANJIVO confirm listing error:",
      error
    );

    return errorResponse(
      "Unable to save listing. Please try again.",
      500,
      "CONFIRM_LISTING_FAILED"
    );
  }
}
