
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { generateListing } from "@/lib/ai/listing-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGES = 10;

type GenerateListingBody = {
  images?: string[];
  productName?: string;
  category?: string;
  brand?: string;
  language?: string;
  sellerId?: string;
};

function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    // Only allow Firebase Storage URLs.
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === "firebasestorage.googleapis.com" ||
      hostname === "storage.googleapis.com"
    );
  } catch {
    return false;
  }
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

    const idToken = authorization.slice(7).trim();

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "Invalid authentication token." },
        { status: 401 }
      );
    }

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

    // 2. Read the authenticated user's role from Firestore.
    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: "User profile not found." },
        { status: 403 }
      );
    }

    const userData = userDoc.data();

    const role = String(userData?.role ?? "").toLowerCase();

    const isAdmin =
      role === "admin" ||
      decodedToken.admin === true;

    const isSeller =
      role === "seller" ||
      role === "vendor";

    if (!isAdmin && !isSeller) {
      return NextResponse.json(
        {
          success: false,
          error: "Only sellers and admins can generate listings.",
        },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body.
    let body: GenerateListingBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const images = body.images;

    if (
      !Array.isArray(images) ||
      images.length === 0 ||
      images.length > MAX_IMAGES
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Upload between 1 and ${MAX_IMAGES} images.`,
        },
        { status: 400 }
      );
    }

    if (
      !images.every(
        (image) =>
          typeof image === "string" &&
          image.length <= 4096 &&
          isValidImageUrl(image)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Images must be valid HTTPS Firebase Storage URLs.",
        },
        { status: 400 }
      );
    }

    // 4. Verify the seller identity.
    // Never trust sellerId sent by the browser.
    let sellerId = uid;

    if (isAdmin) {
      // Admin can generate a listing for a selected seller.
      if (body.sellerId) {
        sellerId = body.sellerId;
      }
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

    // 5. Confirm seller account exists and is active.
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

    if (
      sellerId !== uid &&
      String(sellerData?.role ?? "").toLowerCase() !== "seller" &&
      String(sellerData?.role ?? "").toLowerCase() !== "vendor"
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

    // 6. Generate AI listing.
    const result = await generateListing({
      images,
      sellerId,
      productName:
        typeof body.productName === "string"
          ? body.productName.slice(0, 200)
          : undefined,
      category:
        typeof body.category === "string"
          ? body.category.slice(0, 100)
          : undefined,
      brand:
        typeof body.brand === "string"
          ? body.brand.slice(0, 100)
          : undefined,
      language:
        typeof body.language === "string"
          ? body.language.slice(0, 30)
          : "English",
    });

    // 7. Return draft for seller/admin review.
    // Do not automatically publish the product.
    return NextResponse.json(
      {
        success: true,
        message: "AI listing generated. Please review before publishing.",
        listing: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("AI listing generation error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to generate listing. Please try again.",
      },
      { status: 500 }
    );
  }
}
