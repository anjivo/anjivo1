
/**
 * ANJIVO AI Listing Studio
 * File: app/api/ai/generate-listing/route.ts
 *
 * Secure AI listing generation API.
 *
 * Features:
 * - Firebase ID token authentication
 * - Seller/admin role verification
 * - Seller ownership validation
 * - Active seller account validation
 * - Request and image URL validation
 * - AI listing generation
 * - Generated output validation
 * - Draft-only response; never auto-publishes
 */

import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

import {
  generateListing,
  validateGeneratedListing,
} from "@/lib/ai/listing-generator";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/* =========================================================
   1. CONFIGURATION
========================================================= */

const MAX_IMAGES = 10;

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const MAX_IMAGE_URL_LENGTH = 4096;

const MAX_PRODUCT_NAME_LENGTH = 200;

const MAX_CATEGORY_LENGTH = 100;

const MAX_BRAND_LENGTH = 100;

const MAX_LANGUAGE_LENGTH = 30;

const MAX_HINT_LENGTH = 2000;

const ALLOWED_IMAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

/* =========================================================
   2. REQUEST TYPES
========================================================= */

type GenerateListingBody = {
  images?: string[];

  productName?: string;

  category?: string;

  brand?: string;

  language?: string;

  descriptionHint?: string;

  sellerId?: string;

  variantHints?: {
    sizes?: string[];

    colors?: string[];

    attributes?: Record<string, string[]>;
  };

  generateSEO?: boolean;

  generateAttributes?: boolean;

  generateHighlights?: boolean;

  generateKeywords?: boolean;

  generateVariants?: boolean;

  marketplace?: string;

  existingListingId?: string;
};

/* =========================================================
   3. RESPONSE HELPERS
========================================================= */

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

/* =========================================================
   4. STRING VALIDATION
========================================================= */

function cleanString(
  value: unknown,
  maxLength: number
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const result = value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);

  return result || undefined;
}

function isBooleanOrUndefined(
  value: unknown
): boolean {
  return (
    value === undefined ||
    typeof value === "boolean"
  );
}

/* =========================================================
   5. IMAGE URL VALIDATION
========================================================= */

/**
 * Only allow HTTPS Firebase Storage URLs.
 *
 * Note:
 * URL validation alone does not prove that a Storage
 * object belongs to the authenticated seller.
 *
 * The production Storage ownership check should verify
 * the actual object path and owner metadata using the
 * Firebase Admin Storage SDK before processing.
 */
function isValidImageUrl(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_IMAGE_URL_LENGTH
  ) {
    return false;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    const hostname =
      url.hostname.toLowerCase();

    if (!ALLOWED_IMAGE_HOSTS.has(hostname)) {
      return false;
    }

    // Reject URLs containing credentials.
    if (url.username || url.password) {
      return false;
    }

    // Restrict Firebase Storage URLs to known
    // Firebase download and object URL structures.
    const pathname = url.pathname;

    const isFirebaseDownload =
      hostname ===
        "firebasestorage.googleapis.com" &&
      /^\/v0\/b\/[^/]+\/o\/.+/.test(pathname);

    const isGoogleStorageObject =
      hostname === "storage.googleapis.com" &&
      pathname.split("/").filter(Boolean).length >= 2;

    return (
      isFirebaseDownload ||
      isGoogleStorageObject
    );
  } catch {
    return false;
  }
}

/* =========================================================
   6. REQUEST BODY VALIDATION
========================================================= */

function validateRequestBody(
  body: GenerateListingBody
): string | null {
  if (
    !Array.isArray(body.images) ||
    body.images.length === 0 ||
    body.images.length > MAX_IMAGES
  ) {
    return `Upload between 1 and ${MAX_IMAGES} images.`;
  }

  if (
    !body.images.every(isValidImageUrl)
  ) {
    return "Images must be valid HTTPS Firebase Storage URLs.";
  }

  if (
    body.productName !== undefined &&
    (
      typeof body.productName !== "string" ||
      body.productName.length >
        MAX_PRODUCT_NAME_LENGTH
    )
  ) {
    return "Invalid product name.";
  }

  if (
    body.category !== undefined &&
    (
      typeof body.category !== "string" ||
      body.category.length >
        MAX_CATEGORY_LENGTH
    )
  ) {
    return "Invalid product category.";
  }

  if (
    body.brand !== undefined &&
    (
      typeof body.brand !== "string" ||
      body.brand.length >
        MAX_BRAND_LENGTH
    )
  ) {
    return "Invalid brand name.";
  }

  if (
    body.language !== undefined &&
    (
      typeof body.language !== "string" ||
      body.language.length >
        MAX_LANGUAGE_LENGTH
    )
  ) {
    return "Invalid language.";
  }

  if (
    body.descriptionHint !== undefined &&
    (
      typeof body.descriptionHint !== "string" ||
      body.descriptionHint.length >
        MAX_HINT_LENGTH
    )
  ) {
    return "Product description hint is too long.";
  }

  const booleanFields = [
    body.generateSEO,
    body.generateAttributes,
    body.generateHighlights,
    body.generateKeywords,
    body.generateVariants,
  ];

  if (
    !booleanFields.every(isBooleanOrUndefined)
  ) {
    return "Invalid generation options.";
  }

  if (
    body.sellerId !== undefined &&
    (
      typeof body.sellerId !== "string" ||
      body.sellerId.length > 128
    )
  ) {
    return "Invalid seller ID.";
  }

  if (
    body.marketplace !== undefined &&
    (
      typeof body.marketplace !== "string" ||
      body.marketplace.length > 50
    )
  ) {
    return "Invalid marketplace.";
  }

  if (
    body.existingListingId !== undefined &&
    (
      typeof body.existingListingId !== "string" ||
      body.existingListingId.length > 128
    )
  ) {
    return "Invalid listing ID.";
  }

  if (
    body.variantHints !== undefined &&
    (
      !body.variantHints ||
      typeof body.variantHints !== "object" ||
      Array.isArray(body.variantHints)
    )
  ) {
    return "Invalid variant hints.";
  }

  if (body.variantHints) {
    const { sizes, colors, attributes } =
      body.variantHints;

    if (
      sizes !== undefined &&
      (
        !Array.isArray(sizes) ||
        sizes.length > 50 ||
        !sizes.every(
          (item) =>
            typeof item === "string" &&
            item.length <= 50
        )
      )
    ) {
      return "Invalid variant sizes.";
    }

    if (
      colors !== undefined &&
      (
        !Array.isArray(colors) ||
        colors.length > 50 ||
        !colors.every(
          (item) =>
            typeof item === "string" &&
            item.length <= 50
        )
      )
    ) {
      return "Invalid variant colors.";
    }

    if (
      attributes !== undefined &&
      (
        !attributes ||
        typeof attributes !== "object" ||
        Array.isArray(attributes)
      )
    ) {
      return "Invalid variant attributes.";
    }

    if (attributes) {
      const entries =
        Object.entries(attributes);

      if (entries.length > 20) {
        return "Too many variant attribute groups.";
      }

      for (const [key, values] of entries) {
        if (
          key.length > 100 ||
          !Array.isArray(values) ||
          values.length > 50 ||
          !values.every(
            (item) =>
              typeof item === "string" &&
              item.length <= 100
          )
        ) {
          return "Invalid variant attribute values.";
        }
      }
    }
  }

  return null;
}

/* =========================================================
   7. AUTHENTICATION
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    /* -----------------------------------------------------
       7.1 Check request size
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       7.2 Verify Firebase ID token
    ----------------------------------------------------- */

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return errorResponse(
        "Authentication required.",
        401,
        "UNAUTHORIZED"
      );
    }

    const idToken =
      authorization.slice(7).trim();

    if (!idToken) {
      return errorResponse(
        "Invalid authentication token.",
        401,
        "INVALID_TOKEN"
      );
    }

    let decodedToken;

    try {
      decodedToken =
        await adminAuth.verifyIdToken(
          idToken,
          true
        );
    } catch {
      return errorResponse(
        "Invalid, expired or revoked authentication token.",
        401,
        "INVALID_TOKEN"
      );
    }

    const uid = decodedToken.uid;

    /* -----------------------------------------------------
       7.3 Load authenticated user
    ----------------------------------------------------- */

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
        "Only sellers and admins can generate listings.",
        403,
        "FORBIDDEN"
      );
    }

    if (
      userData?.status &&
      [
        "blocked",
        "suspended",
        "disabled",
      ].includes(
        String(
          userData.status
        ).toLowerCase()
      )
    ) {
      return errorResponse(
        "Your account is not active.",
        403,
        "ACCOUNT_INACTIVE"
      );
    }

    /* -----------------------------------------------------
       8. Parse request body
    ----------------------------------------------------- */

    let body: GenerateListingBody;

    try {
      body =
        await request.json() as GenerateListingBody;
    } catch {
      return errorResponse(
        "Invalid JSON request body.",
        400,
        "INVALID_JSON"
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return errorResponse(
        "Invalid request body.",
        400,
        "INVALID_BODY"
      );
    }

    const validationError =
      validateRequestBody(body);

    if (validationError) {
      return errorResponse(
        validationError,
        400,
        "VALIDATION_FAILED"
      );
    }

    /* -----------------------------------------------------
       9. Resolve seller identity
    ----------------------------------------------------- */

    let sellerId = uid;

    if (isAdmin && body.sellerId) {
      sellerId = body.sellerId;
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

    /* -----------------------------------------------------
       10. Verify seller account
    ----------------------------------------------------- */

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
      [
        "blocked",
        "suspended",
        "disabled",
      ].includes(
        String(
          sellerData.status
        ).toLowerCase()
      )
    ) {
      return errorResponse(
        "Seller account is not active.",
        403,
        "SELLER_INACTIVE"
      );
    }

    /* -----------------------------------------------------
       11. Verify existing listing ownership if editing
    ----------------------------------------------------- */

    if (body.existingListingId) {
      const existingDoc = await adminDb
        .collection("products")
        .doc(body.existingListingId)
        .get();

      if (!existingDoc.exists) {
        return errorResponse(
          "Existing product listing not found.",
          404,
          "PRODUCT_NOT_FOUND"
        );
      }

      const existingData =
        existingDoc.data();

      const existingSellerId = String(
        existingData?.sellerId ?? ""
      );

      if (
        !isAdmin &&
        existingSellerId !== uid
      ) {
        return errorResponse(
          "You cannot modify another seller's listing.",
          403,
          "LISTING_OWNERSHIP_FAILED"
        );
      }

      // This endpoint generates suggestions only.
      // The existing product is not modified here.
    }

    /* -----------------------------------------------------
       12. Generate listing
    ----------------------------------------------------- */

    const images = body.images!;

    const result = await generateListing({
      images,

      sellerId,

      productName: cleanString(
        body.productName,
        MAX_PRODUCT_NAME_LENGTH
      ),

      category: cleanString(
        body.category,
        MAX_CATEGORY_LENGTH
      ),

      brand: cleanString(
        body.brand,
        MAX_BRAND_LENGTH
      ),

      language:
        cleanString(
          body.language,
          MAX_LANGUAGE_LENGTH
        ) || "English",

      descriptionHint: cleanString(
        body.descriptionHint,
        MAX_HINT_LENGTH
      ),

      variantHints: body.variantHints,

      generateSEO:
        body.generateSEO ?? true,

      generateAttributes:
        body.generateAttributes ?? true,

      generateHighlights:
        body.generateHighlights ?? true,

      generateKeywords:
        body.generateKeywords ?? true,

      generateVariants:
        body.generateVariants ?? true,

      marketplace: cleanString(
        body.marketplace,
        50
      ),

      existingListingId:
        body.existingListingId,
    });

    /* -----------------------------------------------------
       13. Validate AI output
    ----------------------------------------------------- */

    const validation =
      validateGeneratedListing(result);

    if (!validation.isValid) {
      console.error(
        "AI listing validation failed:",
        validation.errors
      );

      return errorResponse(
        "AI generated an invalid listing. Please retry.",
        422,
        "AI_OUTPUT_INVALID"
      );
    }

    /* -----------------------------------------------------
       14. Return draft for review
    ----------------------------------------------------- */

    const warnings = [
      ...(result.warnings ?? []),
      ...validation.warnings,
    ];

    return NextResponse.json(
      {
        success: true,

        message:
          "AI listing generated. Review all product details before saving or publishing.",

        listing: {
          ...result,

          // Force safe initial review state.
          status: "draft",

          sellerConfirmed: false,

          adminApproved: false,

          // Compliance and inventory are not
          // confirmed by AI generation.
          hsnCode: "",

          gstRate: null,

          countryOfOrigin: "",

          sellingPrice: null,

          wholesalePrice: null,

          mrp: null,

          stock: 0,

          warnings: [
            ...new Set(warnings),
          ],
        },

        validation: {
          isValid: true,

          warnings: [
            ...new Set(warnings),
          ],
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "ANJIVO AI listing generation error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message.includes(
        "OPENAI_API_KEY is missing"
      )
    ) {
      return errorResponse(
        "AI service is not configured. Please contact the administrator.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    if (
      message.includes(
        "AI returned invalid JSON"
      ) ||
      message.includes(
        "AI returned an invalid listing format"
      )
    ) {
      return errorResponse(
        "AI returned an invalid response. Please try again.",
        422,
        "AI_RESPONSE_INVALID"
      );
    }

    return errorResponse(
      "Unable to generate listing. Please try again.",
      500,
      "AI_GENERATION_FAILED"
    );
  }
}
