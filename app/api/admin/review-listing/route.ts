
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewRequest = {
  productId?: string;
  action?: "approve" | "reject";
  reason?: string;
};

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate admin.
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

    const adminDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    const adminData = adminDoc.data();

    const isAdmin =
      adminDoc.exists &&
      (
        String(adminData?.role ?? "").toLowerCase() === "admin" ||
        decodedToken.admin === true
      );

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    // 2. Validate request.
    let body: ReviewRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { productId, action } = body;

    if (
      typeof productId !== "string" ||
      !productId.trim() ||
      productId.length > 200
    ) {
      return NextResponse.json(
        { success: false, error: "Valid product ID is required." },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: "Invalid review action." },
        { status: 400 }
      );
    }

    // 3. Load product.
    const productRef = adminDb
      .collection("products")
      .doc(productId);

    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Product not found." },
        { status: 404 }
      );
    }

    const product = productDoc.data();

    if (product?.status !== "pending_review") {
      return NextResponse.json(
        {
          success: false,
          error: "Product is not pending review.",
        },
        { status: 409 }
      );
    }

    // 4. Check minimum required listing data.
    if (action === "approve") {
      const title = String(
        product?.title ?? product?.name ?? ""
      ).trim();

      const description = String(
        product?.description ?? ""
      ).trim();

      const category = String(
        product?.category ?? ""
      ).trim();

      const price = product?.price;
      const stock = product?.stock;

      if (
        !title ||
        !description ||
        !category ||
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price < 0 ||
        typeof stock !== "number" ||
        !Number.isInteger(stock) ||
        stock < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Product details are incomplete. Cannot approve.",
          },
          { status: 400 }
        );
      }
    }

    // 5. Update status.
    if (action === "approve") {
      await productRef.update({
        status: "active",
        isApproved: true,
        isPublished: true,
        approvedBy: uid,
        approvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      const reason =
        typeof body.reason === "string"
          ? body.reason.trim().slice(0, 1000)
          : "";

      if (!reason) {
        return NextResponse.json(
          {
            success: false,
            error: "Please provide a rejection reason.",
          },
          { status: 400 }
        );
      }

      await productRef.update({
        status: "rejected",
        isApproved: false,
        isPublished: false,
        rejectionReason: reason,
        rejectedBy: uid,
        rejectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? "Product approved and published."
          : "Product rejected.",
      productId,
      status: action === "approve" ? "active" : "rejected",
    });
  } catch (error) {
    console.error("Admin review listing error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to review product.",
      },
      { status: 500 }
    );
  }
}
