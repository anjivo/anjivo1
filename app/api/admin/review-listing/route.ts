
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// --------------------------------------------------
// GET: Fetch pending AI product listings for admin
// --------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Check authorization header
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    // 2. Verify Firebase ID token
    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(
        authorization.slice(7).trim()
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token.",
        },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;

    // 3. Fetch user document
    const adminDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    const adminData = adminDoc.data();

    const role = String(
      adminData?.role ?? ""
    ).toLowerCase();

    const isAdmin =
      adminDoc.exists &&
      (
        role === "admin" ||
        role === "superadmin" ||
        decodedToken.admin === true
      );

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Admin access required.",
        },
        { status: 403 }
      );
    }

    // 4. Fetch pending products
    const snapshot = await adminDb
      .collection("products")
      .where("status", "==", "pending_review")
      .limit(50)
      .get();

    // 5. Format listings for admin dashboard
    const listings = snapshot.docs.map((doc) => {
      const data = doc.data();

      const createdAt = data.createdAt;

      return {
        id: doc.id,

        title: data.title ?? data.name ?? "",

        description: data.description ?? "",

        category: data.category ?? "",

        brand: data.brand ?? "",

        price: data.price ?? null,

        stock: data.stock ?? null,

        images: Array.isArray(data.images)
          ? data.images
          : Array.isArray(data.imageUrls)
          ? data.imageUrls
          : [],

        sellerId: data.sellerId ?? "",

        createdAt:
          createdAt?.toDate?.()?.toISOString() ?? null,

        status: data.status ?? "pending_review",
      };
    });

    // 6. Return response
    return NextResponse.json({
      success: true,
      listings,
      count: listings.length,
    });
  } catch (error) {
    console.error(
      "Fetch pending listings error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch pending listings.",
      },
      { status: 500 }
    );
  }
}

// --------------------------------------------------
// POST: Approve or reject a product listing
// --------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate admin
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
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
        {
          success: false,
          error: "Invalid or expired token.",
        },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;

    const adminDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    const adminData = adminDoc.data();

    const role = String(
      adminData?.role ?? ""
    ).toLowerCase();

    const isAdmin =
      adminDoc.exists &&
      (
        role === "admin" ||
        role === "superadmin" ||
        decodedToken.admin === true
      );

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Admin access required.",
        },
        { status: 403 }
      );
    }

    // 2. Read request body
    const body = await request.json();

    const { productId, action, rejectionReason } = body;

    if (
      typeof productId !== "string" ||
      !productId.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid productId is required.",
        },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "Action must be approve or reject.",
        },
        { status: 400 }
      );
    }

    // 3. Find product
    const productRef = adminDb
      .collection("products")
      .doc(productId);

    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Product not found.",
        },
        { status: 404 }
      );
    }

    const productData = productDoc.data();

    if (productData?.status !== "pending_review") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This product is not awaiting review.",
        },
        { status: 409 }
      );
    }

    // 4. Approve product
    if (action === "approve") {
      await productRef.update({
        status: "active",
        isApproved: true,
        isPublished: true,
        approvedBy: uid,
        approvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: "Product approved successfully.",
        productId,
        status: "active",
      });
    }

    // 5. Reject product
    const reason =
      typeof rejectionReason === "string"
        ? rejectionReason.trim().slice(0, 500)
        : "";

    await productRef.update({
      status: "rejected",
      isApproved: false,
      isPublished: false,
      rejectionReason: reason,
      rejectedBy: uid,
      rejectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "Product rejected successfully.",
      productId,
      status: "rejected",
    });
  } catch (error) {
    console.error(
      "Admin review listing error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to review listing.",
      },
      { status: 500 }
    );
  }
}
