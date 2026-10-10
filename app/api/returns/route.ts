import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function requireUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: responseError("Authentication required.", 401) };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7).trim());
    return { uid: decoded.uid };
  } catch {
    return { error: responseError("Invalid or expired token.", 401) };
  }
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[ -]+/g, "_");
}

function isDelivered(order: DocumentData): boolean {
  const statuses = [
    normalizeStatus(order.status),
    normalizeStatus(order.orderStatus),
    normalizeStatus(order.fulfillmentStatus),
  ];
  if (statuses.some((status) => ["cancelled", "canceled", "returned", "refunded"].includes(status))) {
    return false;
  }
  return statuses.includes("delivered") || statuses.includes("complete") || statuses.includes("completed");
}

function toIso(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

const allowedReasons = new Set([
  "damaged",
  "wrong_item",
  "missing_item",
  "quality_issue",
  "size_issue",
  "not_as_described",
  "other",
]);

// GET /api/returns?orderId=... — returns only this signed-in customer's requests.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if ("error" in auth) return auth.error;

    const orderId = String(request.nextUrl.searchParams.get("orderId") ?? "").trim();
    if (!orderId || orderId.length > 180 || orderId.includes("/")) {
      return responseError("A valid orderId is required.", 400);
    }

    const orderSnapshot = await adminDb.collection("orders").doc(orderId).get();
    if (!orderSnapshot.exists) return responseError("Order not found.", 404);

    const order = orderSnapshot.data() ?? {};
    if (String(order.customerId ?? order.userId ?? "") !== auth.uid) {
      return responseError("You are not allowed to view returns for this order.", 403);
    }

    const snapshot = await adminDb.collection("returns").where("orderId", "==", orderId).limit(100).get();
    const returns = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => String(item.customerId ?? "") === auth.uid)
      .map((item) => ({
        id: String(item.id),
        orderId: String(item.orderId ?? ""),
        productId: String(item.productId ?? ""),
        returnStatus: String(item.returnStatus ?? item.status ?? "requested"),
        refundStatus: String(item.refundStatus ?? "pending"),
        createdAt: toIso(item.createdAt),
      }));

    return NextResponse.json({ success: true, returns });
  } catch (error) {
    console.error("Get customer returns error:", error);
    return responseError("Unable to load return requests.", 500);
  }
}

// POST /api/returns — create a return request for a delivered product.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);

    if ("error" in auth) return auth.error;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return responseError("Invalid JSON body.", 400);
    }

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const quantity = Number(body.quantity);

    if (
      !orderId || orderId.length > 180 || orderId.includes("/") ||
      !productId || productId.length > 180 || productId.includes("/") ||
      !allowedReasons.has(reason) ||
      !Number.isInteger(quantity) || quantity < 1 ||
      description.length > 1000
    ) {
      return responseError("Please provide a valid order, product, reason, quantity and description.", 400);
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const result = await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) {
        return { ok: false as const, status: 404, error: "Order not found." };
      }

      const order = orderSnapshot.data() ?? {};
      const ownerId = String(order.customerId ?? order.userId ?? "");
      if (ownerId !== auth.uid) {
        return { ok: false as const, status: 403, error: "You are not allowed to return items from this order." };
      }

      if (!isDelivered(order)) {
        return { ok: false as const, status: 409, error: "A return can only be requested after delivery." };
      }

      const items = Array.isArray(order.items) ? order.items as Record<string, unknown>[] : [];
      const item = items.find((candidate) =>
        String(candidate.productId ?? candidate.id ?? "") === productId,
      );
      if (!item) {
        return { ok: false as const, status: 404, error: "Product was not found in this order." };
      }

      const orderedQuantity = Number(item.quantity ?? 0);
      if (!Number.isInteger(orderedQuantity) || quantity > orderedQuantity) {
        return { ok: false as const, status: 400, error: "Return quantity cannot exceed the purchased quantity." };
      }

      // Keep one return request per order/product to prevent duplicate or overlapping requests.
      const existingSnapshot = await transaction.get(
        adminDb.collection("returns").where("orderId", "==", orderId),
      );
      const duplicate = existingSnapshot.docs.some((doc) => {
        const data = doc.data();
        return (
          String(data.customerId ?? "") === auth.uid &&
          String(data.productId ?? "") === productId
        );
      });
      if (duplicate) {
        return { ok: false as const, status: 409, error: "A return request already exists for this product." };
      }

      const selectedPrice = Number(item.selectedPrice ?? item.unitPrice ?? item.price ?? 0);
      const lineSubtotal = Number(item.subtotal ?? 0);
      const unitAmount = selectedPrice > 0
        ? selectedPrice
        : orderedQuantity > 0 && lineSubtotal > 0
          ? lineSubtotal / orderedQuantity
          : 0;
      const amount = Math.round(unitAmount * quantity * 100) / 100;

      const returnRef = adminDb.collection("returns").doc();
      const now = FieldValue.serverTimestamp();
      const returnData = {
        id: returnRef.id,
        orderId,
        productId,
        customerId: auth.uid,
        customerName: String(order.shippingAddress?.fullName ?? order.customerName ?? ""),
        customerEmail: String(order.customerEmail ?? ""),
        customerPhone: String(order.shippingAddress?.phone ?? order.customerPhone ?? ""),
        sellerId: String(item.sellerId ?? ""),
        sellerName: String(item.sellerName ?? ""),
        productName: String(item.name ?? item.productName ?? "Product"),
        quantity,
        amount,
        reason,
        description,
        returnStatus: "requested",
        refundStatus: "pending",
        refundAmount: 0,
        images: [],
        qcStatus: "pending",
        dispute: false,
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(returnRef, returnData);
      return {
        ok: true as const,
        returnRequest: {
          id: returnRef.id,
          orderId,
          productId,
          returnStatus: "requested",
          refundStatus: "pending",
        },
      };
    });

    if (!result.ok) return responseError(result.error, result.status);
    return NextResponse.json({ success: true, returnRequest: result.returnRequest }, { status: 201 });
  } catch (error) {
    console.error("Create customer return request error:", error);
    return responseError("Unable to create return request.", 500);
  }
}
