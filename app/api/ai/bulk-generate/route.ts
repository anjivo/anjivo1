
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

import {
  generateListing,
  validateGeneratedListing,
} from "@/lib/ai/listing-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   ANJIVO AI BULK LISTING GENERATOR
   - Firebase authentication
   - Seller/admin authorization
   - Per-product input validation
   - Independent product generation
   - Individual error handling
   - SEO and attribute generation options
   - Per-product results and summary
========================================================= */

const MAX_PRODUCTS = 10;
const MAX_IMAGES_PER_PRODUCT = 10;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const MAX_IMAGE_URL_LENGTH = 4096;

const ALLOWED_IMAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

type BulkProductInput = {
  id?: string;
  images: string[];
  productName?: string;
  category?: string;
  brand?: string;
  language?: string;
  descriptionHint?: string;

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
  sourceRowNumber?: number;
};

type BulkRequestBody = {
  products?: BulkProductInput[];
  sellerId?: string;

  generateSEO?: boolean;
  generateAttributes?: boolean;
  generateHighlights?: boolean;
  generateKeywords?: boolean;
  generateVariants?: boolean;

  marketplace?: string;
};

type BulkResult = {
  index: number;
  productId?: string;
  success: boolean;
  listing?: Awaited<ReturnType<typeof generateListing>>;
  error?: string;
  warnings?: string[];
  processingTimeMs?: number;
};

/* =========================================================
   1. RESPONSE HELPERS
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
   2. INPUT HELPERS
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

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isBooleanOrUndefined(
  value: unknown
): boolean {
  return (
    value === undefined ||
    typeof value === "boolean"
  );
}

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
      url.pathname
        .split("/")
        .filter(Boolean).length >= 2;

    return isFirebase || isGoogleStorage;
  } catch {
    return false;
  }
}

/* =========================================================
   3. PRODUCT VALIDATION
========================================================= */

function validateProduct(
  product: unknown,
  index: number
): string | null {
  if (!isObject(product)) {
    return `Product ${index + 1}: invalid product data.`;
  }

  if (
    !Array.isArray(product.images) ||
    product.images.length === 0 ||
    product.images.length > MAX_IMAGES_PER_PRODUCT
  ) {
    return (
      `Product ${index + 1}: upload between 1 and ` +
      `${MAX_IMAGES_PER_PRODUCT} images.`
    );
  }

  if (
    !product.images.every(isValidImageUrl)
  ) {
    return (
      `Product ${index + 1}: invalid Firebase Storage image URL.`
    );
  }

  const stringFields: Array<
    [unknown, number, string]
  > = [
    [
      product.productName,
      200,
      "product name",
    ],
    [
      product.category,
      100,
      "category",
    ],
    [
      product.brand,
      100,
      "brand",
    ],
    [
      product.language,
      30,
      "language",
    ],
    [
      product.descriptionHint,
      2000,
      "description hint",
    ],
    [
      product.marketplace,
      50,
      "marketplace",
    ],
  ];

  for (const [value, maxLength, label] of stringFields) {
    if (
      value !== undefined &&
      (
        typeof value !== "string" ||
        value.length > maxLength
      )
    ) {
      return (
        `Product ${index + 1}: invalid ${label}.`
      );
    }
  }

  const booleanFields = [
    product.generateSEO,
    product.generateAttributes,
    product.generateHighlights,
    product.generateKeywords,
    product.generateVariants,
  ];

  if (
    !booleanFields.every(isBooleanOrUndefined)
  ) {
    return (
      `Product ${index + 1}: invalid generation options.`
    );
  }

  if (
    product.id !== undefined &&
    (
      typeof product.id !== "string" ||
      product.id.length > 128
    )
  ) {
    return (
      `Product ${index + 1}: invalid product ID.`
    );
  }

  if (
    product.sourceRowNumber !== undefined &&
    (
      typeof product.sourceRowNumber !== "number" ||
      !Number.isInteger(product.sourceRowNumber) ||
      product.sourceRowNumber < 1
    )
  ) {
    return (
      `Product ${index + 1}: invalid source row number.`
    );
  }

  if (
    product.variantHints !== undefined &&
    !isObject(product.variantHints)
  ) {
    return (
      `Product ${index + 1}: invalid variant hints.`
    );
  }

  if (isObject(product.variantHints)) {
    const hints = product.variantHints;

    for (const key of ["sizes", "colors"] as const) {
      const values = hints[key];

      if (
        values !== undefined &&
        (
          !Array.isArray(values) ||
          values.length > 50 ||
          !values.every(
            (item) =>
              typeof item === "string" &&
              item.length <= 100
          )
        )
      ) {
        return (
          `Product ${index + 1}: invalid variant ${key}.`
        );
      }
    }

    if (
      hints.attributes !== undefined &&
      !isObject(hints.attributes)
    ) {
      return (
        `Product ${index + 1}: invalid variant attributes.`
      );
    }

    if (isObject(hints.attributes)) {
      const entries =
        Object.entries(hints.attributes);

      if (entries.length > 20) {
        return (
          `Product ${index + 1}: too many variant attribute groups.`
        );
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
          return (
            `Product ${index + 1}: invalid variant attribute values.`
          );
        }
      }
    }
  }

  return null;
}

/* =========================================================
   4. MAIN POST HANDLER
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    /* -----------------------------------------------------
       4.1 Request size
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
       4.2 Firebase authentication
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
        "Invalid or expired authentication token.",
        401,
        "INVALID_TOKEN"
      );
    }

    const uid = decodedToken.uid;

    /* -----------------------------------------------------
       4.3 Read trusted user role
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
        "Only sellers and admins can generate bulk listings.",
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
        String(userData.status).toLowerCase()
      )
    ) {
      return errorResponse(
        "Your account is not active.",
        403,
        "ACCOUNT_INACTIVE"
      );
    }

    /* -----------------------------------------------------
       4.4 Parse request
    ----------------------------------------------------- */

    let body: BulkRequestBody;

    try {
      body =
        await request.json() as BulkRequestBody;
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

    const products = body.products;

    if (
      !Array.isArray(products) ||
      products.length === 0 ||
      products.length > MAX_PRODUCTS
    ) {
      return errorResponse(
        `Submit between 1 and ${MAX_PRODUCTS} products per request.`,
        400,
        "INVALID_PRODUCT_COUNT"
      );
    }

    /* -----------------------------------------------------
       4.5 Validate global options
    ----------------------------------------------------- */

    const globalBooleanFields = [
      body.generateSEO,
      body.generateAttributes,
      body.generateHighlights,
      body.generateKeywords,
      body.generateVariants,
    ];

    if (
      !globalBooleanFields.every(
        isBooleanOrUndefined
      )
    ) {
      return errorResponse(
        "Invalid generation options.",
        400,
        "INVALID_OPTIONS"
      );
    }

    if (
      body.marketplace !== undefined &&
      (
        typeof body.marketplace !== "string" ||
        body.marketplace.length > 50
      )
    ) {
      return errorResponse(
        "Invalid marketplace.",
        400,
        "INVALID_MARKETPLACE"
      );
    }

    /* -----------------------------------------------------
       4.6 Resolve seller identity
    ----------------------------------------------------- */

    let sellerId = uid;

    if (isAdmin && body.sellerId) {
      sellerId = cleanString(
        body.sellerId,
        128
      ) || "";
    }

    if (
      isSeller &&
      body.sellerId &&
      body.sellerId !== uid
    ) {
      return errorResponse(
        "You cannot generate listings for another seller.",
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

    /* -----------------------------------------------------
       4.7 Verify seller account
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
        String(sellerData.status).toLowerCase()
      )
    ) {
      return errorResponse(
        "Seller account is not active.",
        403,
        "SELLER_INACTIVE"
      );
    }

    /* -----------------------------------------------------
       4.8 Validate all products before AI calls
    ----------------------------------------------------- */

    for (let i = 0; i < products.length; i++) {
      const validationError =
        validateProduct(products[i], i);

      if (validationError) {
        return errorResponse(
          validationError,
          400,
          "PRODUCT_VALIDATION_FAILED"
        );
      }
    }

    /* -----------------------------------------------------
       4.9 Generate listings independently
    ----------------------------------------------------- */

    const results: BulkResult[] = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      const startedAt = Date.now();

      try {
        const listing = await generateListing({
          images: product.images,

          sellerId,

          productName: cleanString(
            product.productName,
            200
          ),

          category: cleanString(
            product.category,
            100
          ),

          brand: cleanString(
            product.brand,
            100
          ),

          language:
            cleanString(
              product.language,
              30
            ) || "English",

          descriptionHint: cleanString(
            product.descriptionHint,
            2000
          ),

          variantHints: product.variantHints,

          generateSEO:
            product.generateSEO ??
            body.generateSEO ??
            true,

          generateAttributes:
            product.generateAttributes ??
            body.generateAttributes ??
            true,

          generateHighlights:
            product.generateHighlights ??
            body.generateHighlights ??
            true,

          generateKeywords:
            product.generateKeywords ??
            body.generateKeywords ??
            true,

          generateVariants:
            product.generateVariants ??
            body.generateVariants ??
            true,

          marketplace:
            cleanString(
              product.marketplace,
              50
            ) ||
            cleanString(
              body.marketplace,
              50
            ),
        });

        /* Validate the generated result */

        const validation =
          validateGeneratedListing(listing);

        if (!validation.isValid) {
          results.push({
            index: i,

            productId: product.id,

            success: false,

            error:
              "AI generated invalid product data. Please retry this product.",

            warnings: validation.warnings,

            processingTimeMs:
              Date.now() - startedAt,
          });

          continue;
        }

        results.push({
          index: i,

          productId: product.id,

          success: true,

          listing: {
            ...listing,

            // Generated results are drafts.
            // They are not saved or published here.
            warnings: [
              ...(listing.warnings ?? []),
              ...validation.warnings,
            ],
          },

          warnings: [
            ...(listing.warnings ?? []),
            ...validation.warnings,
          ],

          processingTimeMs:
            Date.now() - startedAt,
        });
      } catch (error) {
        console.error(
          `Bulk AI generation failed for product ${i + 1}:`,
          error
        );

        results.push({
          index: i,

          productId: product.id,

          success: false,

          error:
            "AI generation failed for this product. Retry this product separately.",

          processingTimeMs:
            Date.now() - startedAt,
        });
      }
    }

    /* -----------------------------------------------------
       4.10 Summary
    ----------------------------------------------------- */

    const successful = results.filter(
      (result) => result.success
    ).length;

    const failed =
      results.length - successful;

    const status =
      failed === 0
        ? "completed"
        : successful === 0
          ? "failed"
          : "completed_with_errors";

    /* -----------------------------------------------------
       4.11 Return results
    ----------------------------------------------------- */

    return NextResponse.json(
      {
        success: successful > 0,

        message:
          failed === 0
            ? "All bulk listings generated successfully."
            : successful === 0
              ? "All product generations failed."
              : "Bulk generation completed with some errors.",

        status,

        summary: {
          total: products.length,

          successful,

          failed,

          progressPercent: 100,
        },

        results,
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
      "ANJIVO bulk AI listing API error:",
      error
    );

    return errorResponse(
      "Unable to process bulk listings. Please try again.",
      500,
      "BULK_GENERATION_FAILED"
    );
  }
}
