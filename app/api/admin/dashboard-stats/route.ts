import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

async function countCollection(collectionName: string): Promise<number> {
  const snapshot = await getAdminDb().collection(collectionName).count().get();
  return snapshot.data().count;
}

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

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError("Authentication required.", 401);

    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(match[1], true);
    } catch {
      return jsonError("Your session is invalid or expired. Please sign in again.", 401);
    }

    const authUser = await getAdminAuth().getUser(decodedToken.uid);
    if (!authUser.emailVerified) {
      return jsonError("Admin email verification is required.", 403);
    }
    if (!authUser.phoneNumber) {
      return jsonError("Admin phone verification is required.", 403);
    }

    const profileSnapshot = await getAdminDb().collection("users").doc(decodedToken.uid).get();
    if (!profileSnapshot.exists) return jsonError("Admin profile was not found.", 403);

    const profile = profileSnapshot.data() ?? {};
    const role = String(profile.role ?? "").toUpperCase();
    const accountStatus = String(profile.accountStatus ?? "").toUpperCase();
    if (!["ADMIN", "SUPERADMIN"].includes(role) || accountStatus !== "ACTIVE") {
      return jsonError("Access denied. An active admin account is required.", 403);
    }

    const [
      users, sellers, products, activeProducts, draftProducts, blockedProducts,
      outOfStockProducts, orders, pendingOrders, deliveredOrders, cancelledOrders,
      categories, reviews, pendingReviews, pendingSellers, approvedSellers,
      blockedSellers, wholesaleEnquiries, returns, pendingReturns, coupons, notifications,
    ] = await Promise.all([
      countCollection("users"),
      countCollection("sellers"),
      countCollection("products"),
      countWhere("products", "status", "active"),
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
      users, sellers, products, activeProducts, draftProducts, blockedProducts,
      outOfStockProducts, orders, pendingOrders, deliveredOrders, cancelledOrders,
      categories, reviews, pendingReviews, pendingSellers, approvedSellers,
      blockedSellers, wholesaleEnquiries, returns, pendingReturns, coupons, notifications,
    };

    return NextResponse.json({ stats }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("GET /api/admin/dashboard-stats failed:", error);
    return jsonError("Unable to load dashboard statistics. Check Firebase Admin credentials and server logs.", 500);
  }
}
