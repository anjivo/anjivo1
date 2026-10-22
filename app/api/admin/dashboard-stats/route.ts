import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

/**
 * Count every document in a collection using a Firestore aggregation query.
 */
async function countCollection(collectionName: string): Promise<number> {
  const snapshot = await getAdminDb()
    .collection(collectionName)
    .count()
    .get();

  return snapshot.data().count;
}

/**
 * Count documents matching an exact field value.
 */
async function countWhere(
  collectionName: string,
  field: string,
  value: string
): Promise<number> {
  const snapshot = await getAdminDb()
    .collection(collectionName)
    .where(field, "==", value)
    .count()
    .get();

  return snapshot.data().count;
}

/**
 * Fallback count using the collection snapshot.
 * Used only if the aggregate products count conflicts with the active count.
 */
async function countCollectionBySnapshot(
  collectionName: string
): Promise<number> {
  const snapshot = await getAdminDb().collection(collectionName).get();
  return snapshot.size;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Require a Firebase ID token.
    const authorization = request.headers.get("authorization") ?? "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return jsonError("Authentication required.", 401);
    }

    // 2. Verify the token and reject revoked/disabled sessions.
    let decodedToken;

    try {
      decodedToken = await getAdminAuth().verifyIdToken(match[1], true);
    } catch (error) {
      console.warn(
        "[ADMIN DASHBOARD STATS] Firebase token verification failed:",
        error
      );
      return jsonError(
        "Your session is invalid or expired. Please sign in again.",
        401
      );
    }

    // 3. Verify the caller's Firestore admin profile.
    const db = getAdminDb();
    const profileSnapshot = await db
      .collection("users")
      .doc(decodedToken.uid)
      .get();

    if (!profileSnapshot.exists) {
      return jsonError("Admin profile was not found.", 403);
    }

    const profile = profileSnapshot.data() ?? {};
    const role = String(profile.role ?? "").toUpperCase();
    const accountStatus = String(profile.accountStatus ?? "").toUpperCase();

    if (!["ADMIN", "SUPERADMIN"].includes(role) || accountStatus !== "ACTIVE") {
      return jsonError(
        "Access denied. An active admin account is required.",
        403
      );
    }

    // 4. Count products and active products first so their relationship can
    // be validated before returning dashboard stats.
    let [products, activeProducts] = await Promise.all([
      countCollection("products"),
      countWhere("products", "status", "active"),
    ]);

    // A collection's total count cannot be lower than the count of a subset.
    // If aggregation results conflict, retry the total with a document snapshot
    // rather than silently showing an incorrect zero.
    if (products < activeProducts) {
      console.error(
        "[ADMIN DASHBOARD STATS] Product count mismatch from aggregate queries.",
        {
          aggregateProducts: products,
          activeProducts,
        }
      );

      products = await countCollectionBySnapshot("products");
    }

    if (products < activeProducts) {
      console.error(
        "[ADMIN DASHBOARD STATS] Product count mismatch persists after fallback.",
        {
          products,
          activeProducts,
        }
      );

      return jsonError(
        "Product counts are inconsistent. Check the Firebase project and products collection used by the deployed application.",
        500
      );
    }

    // 5. Fetch the remaining counts from the same Firebase Admin Firestore
    // instance. Admin SDK queries bypass client Firestore Security Rules.
    const [
      users,
      sellers,
      draftProducts,
      blockedProducts,
      outOfStockProducts,
      orders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      categories,
      reviews,
      pendingReviews,
      pendingSellers,
      approvedSellers,
      blockedSellers,
      wholesaleEnquiries,
      returns,
      pendingReturns,
      coupons,
      notifications,
    ] = await Promise.all([
      countCollection("users"),
      countCollection("sellers"),
      countWhere("products", "status", "draft"),
      countWhere("products", "status", "blocked"),
      countWhere("products", "status", "out_of_stock"),
      countCollection("orders"),
      countWhere("orders", "status", "pending"),
      countWhere("orders", "status", "delivered"),
      countWhere("orders", "status", "cancelled"),
      countCollection("categories"),
      countCollection("reviews"),
      countWhere("reviews", "status", "pending"),
      countWhere("sellers", "status", "pending"),
      countWhere("sellers", "status", "approved"),
      countWhere("sellers", "status", "blocked"),
      countCollection("wholesaleEnquiries"),
      countCollection("returns"),
      countWhere("returns", "status", "pending"),
      countCollection("coupons"),
      countCollection("notifications"),
    ]);

    const stats = {
      users,
      sellers,
      products,
      activeProducts,
      draftProducts,
      blockedProducts,
      outOfStockProducts,
      orders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      categories,
      reviews,
      pendingReviews,
      pendingSellers,
      approvedSellers,
      blockedSellers,
      wholesaleEnquiries,
      returns,
      pendingReturns,
      coupons,
      notifications,
    };

    return NextResponse.json(
      { stats },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[ADMIN DASHBOARD STATS] Request failed:", error);

    return jsonError(
      "Unable to load dashboard statistics. Check Firebase Admin credentials and server logs.",
      500
    );
  }
}
