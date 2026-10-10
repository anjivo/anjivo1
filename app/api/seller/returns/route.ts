import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/firebase-admin-auth";

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function safeDate(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyIdToken(request.headers.get("authorization"));
    const sellerId = decodedToken.uid;
    if (!sellerId) return jsonError("Seller authentication failed.", 401);

    const sellerSnapshot = await adminDb.collection("users").doc(sellerId).get();
    if (!sellerSnapshot.exists) return jsonError("Seller account not found.", 404);
    const seller = sellerSnapshot.data() || {};
    if (seller.role !== "SELLER") return jsonError("Only sellers can view return requests.", 403);
    if (seller.sellerStatus !== "approved") return jsonError("Seller account is not approved.", 403);

    const statusFilter = (request.nextUrl.searchParams.get("status") || "all").trim().toLowerCase();
    const snapshot = await adminDb.collection("returns").where("sellerId", "==", sellerId).get();
    const returns = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .filter((item) => statusFilter === "all" || String(item.returnStatus || "requested").toLowerCase() === statusFilter)
      .sort((a, b) => safeDate(b.createdAt) - safeDate(a.createdAt));

    return NextResponse.json({ success: true, returns });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load return requests.";
    const unauthorized = /token|authorization|unauthenticated|expired/i.test(message);
    return jsonError(unauthorized ? "Please sign in again." : "Unable to load return requests.", unauthorized ? 401 : 500);
  }
}
