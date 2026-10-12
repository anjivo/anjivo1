
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PRODUCTS = 100;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 10;

const ALLOWED_IMAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

type InputProduct = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  shortDescription?: unknown;
  category?: unknown;
  subcategory?: unknown;
  brand?: unknown;
  sellingPrice?: unknown;
  price?: unknown;
  wholesalePrice?: unknown;
  mrp?: unknown;
  stock?: unknown;
  sku?: unknown;
  images?: unknown;
  imageUrls?: unknown;
  keywords?: unknown;
  highlights?: unknown;
  attributes?: unknown;
  seo?: unknown;
};

type RequestBody = {
  products?: unknown;
  publish?: unknown;
};

function fail(
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
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function cleanString(
  value: unknown,
  maxLength = 500
): string {
  if (typeof value !== "string") return "";

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
    value <= 100_000_000
  );
}

function validStock(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 10_000_000
  );
}

function validImageUrl(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 4096
  ) {
    return false;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())
    ) {
      return false;
    }

    if (
      url.hostname === "firebasestorage.googleapis.com"
    ) {
      return /^\/v0\/b\/[^/]+\/o\/.+/.test(url.pathname);
    }

    return (
      url.hostname === "storage.googleapis.com" &&
      url.pathname.split("/").filter(Boolean).length >= 2
    );
  } catch {
    return false;
  }
}

function cleanStringArray(
  value: unknown,
  maxItems = 30,
  maxLength = 200
): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((item): item is string =>
          typeof item === "string"
        )
        .map((item) => cleanString(item, maxLength))
        .filter(Boolean)
    ),
  ].slice(0, maxItems);
}

function cleanAttributes(
  value: unknown
): Record<string, string> {
  if (!isObject(value)) return {};

  const output: Record<string, string> = {};

  for (const [key, raw] of Object.entries(value).slice(0, 50)) {
    const safeKey = cleanString(key, 100);

    if (!safeKey) continue;

    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      output[safeKey] = String(raw).slice(0, 300);
    } else if (
      Array.isArray(raw) &&
      raw.length <= 50 &&
      raw.every((item) => typeof item === "string")
    ) {
      output[safeKey] = raw
        .map((item) => cleanString(item, 100))
        .filter(Boolean)
        .join(", ")
        .slice(0, 1000);
    }
  }

  return output;
}

function cleanSeo(value: unknown) {
  if (!isObject(value)) return {};

  return {
    metaTitle: cleanString(value.metaTitle, 70),
    metaDescription: cleanString(value.metaDescription, 200),
    slug: cleanString(value.slug, 200)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, ""),
    primaryKeyword: cleanString(value.primaryKeyword, 100),
    secondaryKeywords: cleanStringArray(
      value.secondaryKeywords
    ),
    searchTerms: cleanStringArray(value.searchTerms),
    tags: cleanStringArray(value.tags, 30, 50),
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Request size validation
    const contentLength = request.headers.get("content-length");

    if (
      contentLength &&
      Number(contentLength) > MAX_BODY_BYTES
    ) {
      return fail(
        "Request body is too large.",
        413,
        "REQUEST_TOO_LARGE"
      );
    }

    // 2. Verify Firebase ID token
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return fail(
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
      return fail(
        "Invalid or expired token.",
        401,
        "INVALID_TOKEN"
      );
    }

    const uid = decodedToken.uid;

    // 3. Verify trusted admin role from Firestore
    const userDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      return fail("Admin profile not found.", 403);
    }

    const userData = userDoc.data();

    const role = String(userData?.role ?? "").toLowerCase();

    const isAdmin =
      role === "admin" ||
      decodedToken.admin === true;

    if (!isAdmin) {
      return fail(
        "Only administrators can bulk-save products.",
        403,
        "ADMIN_ONLY"
      );
    }

    if (
      ["blocked", "suspended", "disabled"].includes(
        String(userData?.status ?? "").toLowerCase()
      )
    ) {
      return fail("Admin account is not active.", 403);
    }

    // 4. Parse request
    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return fail("Invalid JSON request.", 400);
    }

    if (!isObject(body)) {
      return fail("Invalid request body.", 400);
    }

    if (body.publish !== undefined &&
        typeof body.publish !== "boolean") {
      return fail("Invalid publish option.", 400);
    }

    if (
      !Array.isArray(body.products) ||
      body.products.length === 0 ||
      body.products.length > MAX_PRODUCTS
    ) {
      return fail(
        `Submit between 1 and ${MAX_PRODUCTS} products.`,
        400,
        "INVALID_PRODUCT_COUNT"
      );
    }

    const publish = body.publish === true;

    // 5. Validate and sanitize every product before writing
    const prepared: Array<{
      data: Record<string, unknown>;
      sku: string;
    }> = [];

    const requestSkus = new Set<string>();

    for (let index = 0; index < body.products.length; index++) {
      const raw = body.products[index];

      if (!isObject(raw)) {
        return fail(`Product ${index + 1}: invalid data.`, 400);
      }

      const title = cleanString(raw.title ?? raw.name, 200);
      const description = cleanString(raw.description, 12000);
      const shortDescription = cleanString(
        raw.shortDescription,
        500
      );
      const category = cleanString(raw.category, 150);
      const subcategory = cleanString(raw.subcategory, 150);
      const brand = cleanString(raw.brand, 150);

      const price = raw.sellingPrice ?? raw.price;
      const stock = raw.stock;
      const wholesalePrice = raw.wholesalePrice ?? null;
      const mrp = raw.mrp ?? null;

      const rawImages = Array.isArray(raw.images)
        ? raw.images
        : raw.imageUrls;

      if (!title || !description || !category) {
        return fail(
          `Product ${index + 1}: title, description and category are required.`,
          400
        );
      }

      if (
        !validPrice(price) ||
        price <= 0 ||
        !validStock(stock)
      ) {
        return fail(
          `Product ${index + 1}: invalid selling price or stock.`,
          400
        );
      }

      if (
        wholesalePrice !== null &&
        !validPrice(wholesalePrice)
      ) {
        return fail(
          `Product ${index + 1}: invalid wholesale price.`,
          400
        );
      }

      if (mrp !== null && !validPrice(mrp)) {
        return fail(
          `Product ${index + 1}: invalid MRP.`,
          400
        );
      }

      if (
        !Array.isArray(rawImages) ||
        rawImages.length === 0 ||
        rawImages.length > MAX_IMAGES ||
        !rawImages.every(validImageUrl)
      ) {
        return fail(
          `Product ${index + 1}: invalid product images.`,
          400
        );
      }

      const images = [...new Set(rawImages as string[])];

      const sku = cleanString(raw.sku, 100);
      const normalizedSku = sku.toLowerCase();

      if (sku && requestSkus.has(normalizedSku)) {
        return fail(
          `Duplicate SKU in this batch: ${sku}`,
          409,
          "DUPLICATE_SKU"
        );
      }

      if (sku) requestSkus.add(normalizedSku);

      const keywords = cleanStringArray(
        raw.keywords ?? raw.searchKeywords
      );

      const highlights = cleanStringArray(
        raw.highlights,
        10,
        300
      );

      const attributes = cleanAttributes(raw.attributes);
      const seo = cleanSeo(raw.seo);

      prepared.push({
        sku,
        data: {
          name: title,
          title,
          description,
          shortDescription,
          category,
          subcategory,
          brand,

          price,
          sellingPrice: price,
          wholesalePrice,
          mrp,
          stock,

          images,
          imageUrls: images,

          sku: sku || undefined,

          keywords,
          searchKeywords: keywords,
          highlights,
          attributes,
          seo,

          variants: [],

          sellerId: uid,
          sellerName: "ANJIVO Official",
          sellerVerified: true,

          createdBy: uid,
          createdByRole: "admin",

          status: publish ? "active" : "draft",
          isPublished: publish,
          isApproved: true,
          adminApproved: true,

          sellerConfirmed: true,
          sellerConfirmedBy: uid,

          confirmedFields: [
            "title",
            "description",
            "category",
            "sellingPrice",
            "stock",
            "images",
          ],

          source: "ai_bulk_listing",
          aiGenerated: true,

          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),

          ...(publish
            ? {
                adminApprovedBy: uid,
                adminApprovedAt: FieldValue.serverTimestamp(),
              }
            : {}),
        },
      });
    }

    // 6. Check existing SKUs in Firestore
    for (const product of prepared) {
      if (!product.sku) continue;

      const existing = await adminDb
        .collection("products")
        .where("sku", "==", product.sku)
        .limit(1)
        .get();

      if (!existing.empty) {
        return fail(
          `SKU already exists: ${product.sku}`,
          409,
          "DUPLICATE_SKU"
        );
      }
    }

    // 7. Write all products in one batch
    const batch = adminDb.batch();
    const createdIds: string[] = [];

    for (const product of prepared) {
      const productRef = adminDb
        .collection("products")
        .doc();

      batch.set(productRef, product.data);
      createdIds.push(productRef.id);
    }

    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        message: publish
          ? "Products saved and marked active."
          : "Products saved as drafts.",
        count: createdIds.length,
        productIds: createdIds,
        status: publish ? "active" : "draft",
        isPublished: publish,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("AI bulk save error:", error);

    return fail(
      "Unable to save products. Check server logs and Firebase configuration.",
      500,
      "BULK_SAVE_FAILED"
    );
  }
}
