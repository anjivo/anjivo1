import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type PartnerAuth = {
  uid: string;
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function requireActiveDeliveryPartner(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { error: errorResponse("Authentication required.", 401) };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authorization.slice(7).trim());
  } catch {
    return { error: errorResponse("Invalid or expired token.", 401) };
  }

  const partnerSnapshot = await adminDb
    .collection("deliveryPartners")
    .where("authUid", "==", decodedToken.uid)
    .limit(1)
    .get();

  if (partnerSnapshot.empty) {
    return { error: errorResponse("Delivery partner profile not found.", 403) };
  }

  const partnerDoc = partnerSnapshot.docs[0];
  const partnerData = partnerDoc.data();

  if (String(partnerData.status ?? "").trim().toLowerCase() !== "active") {
    return {
      error: errorResponse("Your delivery partner account is inactive.", 403),
    };
  }

  return {
    partner: {
      uid: decodedToken.uid,
      partnerId: partnerDoc.id,
      partnerName: String(partnerData.name ?? ""),
      partnerPhone: String(partnerData.phone ?? ""),
    } satisfies PartnerAuth,
  };
}

function timestampToIso(value: unknown): string | null {
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

function serializeOrder(id: string, data: DocumentData) {
  const rawItems = Array.isArray(data.items) ? data.items : [];

  return {
    id,
    customerId: String(data.customerId ?? data.userId ?? ""),
    shippingAddress: data.shippingAddress ?? null,
    items: rawItems.map((item: Record<string, unknown>) => ({
      productId: String(item.productId ?? ""),
      productName: String(item.productName ?? item.name ?? "Product"),
      quantity: Number(item.quantity ?? 0),
      image: String(item.image ?? ""),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
    })),
    subtotal: Number(data.subtotal ?? 0),
    shippingCharge: Number(data.shippingCharge ?? 0),
    // Support both field names because order schemas may store totalAmount.
    total: Number(data.total ?? data.totalAmount ?? 0),
    paymentMethod: String(data.paymentMethod ?? ""),
    paymentStatus: String(data.paymentStatus ?? "PENDING"),
    status: String(data.status ?? data.orderStatus ?? "PLACED").toLowerCase(),
    orderStatus: String(data.orderStatus ?? data.status ?? "PLACED").toLowerCase(),
    fulfillmentStatus: String(data.fulfillmentStatus ?? "PENDING").toLowerCase(),
    deliveryAssignmentStatus: String(
      data.deliveryAssignmentStatus ?? "assigned",
    ).toLowerCase(),
    deliveryPartnerId: String(data.deliveryPartnerId ?? ""),
    deliveryPartnerName: String(data.deliveryPartnerName ?? ""),
    deliveryPartnerPhone: String(data.deliveryPartnerPhone ?? ""),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
}

function isTerminalOrder(data: DocumentData): boolean {
  const terminal = new Set([
    "cancelled",
    "canceled",
    "refunded",
    "returned",
    "delivered",
  ]);
  return [data.status, data.orderStatus, data.fulfillmentStatus].some((value) =>
    terminal.has(normalizeStatus(value)),
  );
}

// GET: Return only orders assigned to the signed-in active delivery partner.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveDeliveryPartner(request);
    if ("error" in auth) return auth.error;

    const snapshot = await adminDb
      .collection("orders")
      .where("deliveryPartnerId", "==", auth.partner.partnerId)
      .limit(200)
      .get();

    const orders = snapshot.docs
      .map((doc) => serializeOrder(doc.id, doc.data()))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return NextResponse.json({
      success: true,
      partner: {
        id: auth.partner.partnerId,
        name: auth.partner.partnerName,
        phone: auth.partner.partnerPhone,
      },
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("List assigned delivery orders error:", error);
    return errorResponse("Unable to load assigned orders.", 500);
  }
}

// PATCH: Update delivery progress only for an order assigned to this partner.
// Body: { orderId: string, status: "shipped" | "out_for_delivery" | "delivered" }
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireActiveDeliveryPartner(request);
    if ("error" in auth) return auth.error;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body.", 400);
    }

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const requestedStatus =
      typeof body.status === "string" ? normalizeStatus(body.status) : "";
    const allowedStatuses = new Set(["shipped", "out_for_delivery", "delivered"]);

    if (
      !orderId ||
      orderId.length > 180 ||
      orderId.includes("/") ||
      !allowedStatuses.has(requestedStatus)
    ) {
      return errorResponse(
        "A valid orderId and status (shipped, out_for_delivery, delivered) are required.",
        400,
      );
    }

    const orderRef = adminDb.collection("orders").doc(orderId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);

      if (!orderSnapshot.exists) {
        return { ok: false as const, status: 404, error: "Order not found." };
      }

      const orderData = orderSnapshot.data() ?? {};
      if (orderData.deliveryPartnerId !== auth.partner.partnerId) {
        return {
          ok: false as const,
          status: 403,
          error: "This order is not assigned to your account.",
        };
      }

      if (isTerminalOrder(orderData)) {
        const alreadyDelivered =
          normalizeStatus(orderData.fulfillmentStatus) === "delivered" ||
          normalizeStatus(orderData.orderStatus) === "delivered" ||
          normalizeStatus(orderData.status) === "delivered";

        if (alreadyDelivered && requestedStatus === "delivered") {
          return {
            ok: true as const,
            alreadyDelivered: true,
            order: serializeOrder(orderSnapshot.id, orderData),
          };
        }

        return {
          ok: false as const,
          status: 409,
          error: "This order is already delivered, cancelled, returned, or refunded.",
        };
      }

      const currentFulfillment = normalizeStatus(orderData.fulfillmentStatus);
      const currentOrderStatus = normalizeStatus(
        orderData.orderStatus ?? orderData.status,
      );
      const progressRank: Record<string, number> = {
        pending: 0,
        processing: 0,
        confirmed: 0,
        placed: 0,
        shipped: 1,
        picked_up: 1,
        out_for_delivery: 2,
        delivered: 3,
      };
      const currentRank = Math.max(
        progressRank[currentFulfillment] ?? 0,
        progressRank[currentOrderStatus] ?? 0,
      );
      const requestedRank = progressRank[requestedStatus] ?? -1;

      if (requestedRank < currentRank) {
        return {
          ok: false as const,
          status: 409,
          error: "Delivery status cannot move backwards.",
        };
      }

      if (requestedStatus === "out_for_delivery" && currentRank < 1) {
        return {
          ok: false as const,
          status: 409,
          error: "Mark the order as shipped/picked up before out for delivery.",
        };
      }

      if (requestedStatus === "delivered" && currentRank < 2) {
        return {
          ok: false as const,
          status: 409,
          error: "Mark the order out for delivery before marking it delivered.",
        };
      }

      const now = FieldValue.serverTimestamp();
      const assignmentStatus =
        requestedStatus === "shipped"
          ? "picked_up"
          : requestedStatus === "out_for_delivery"
            ? "out_for_delivery"
            : "delivered";

      transaction.update(orderRef, {
        // Keep the existing order status fields consistent with the current API.
        status: requestedStatus,
        orderStatus: requestedStatus,
        fulfillmentStatus: requestedStatus,
        deliveryAssignmentStatus: assignmentStatus,
        deliveryStatusUpdatedAt: now,
        deliveryStatusUpdatedBy: auth.partner.uid,
        updatedAt: now,
      });

      const auditRef = adminDb.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        action: "DELIVERY_STATUS_UPDATED",
        entityType: "order",
        entityId: orderId,
        actorUid: auth.partner.uid,
        details: {
          deliveryPartnerId: auth.partner.partnerId,
          previousFulfillmentStatus: currentFulfillment || null,
          newStatus: requestedStatus,
        },
        createdAt: now,
      });

      return { ok: true as const, alreadyDelivered: false };
    });

    if (!result.ok) return errorResponse(result.error, result.status);

    if (result.alreadyDelivered && "order" in result) {
      return NextResponse.json({
        success: true,
        alreadyDelivered: true,
        order: result.order,
      });
    }

    const updatedSnapshot = await orderRef.get();
    return NextResponse.json({
      success: true,
      order: serializeOrder(updatedSnapshot.id, updatedSnapshot.data() ?? {}),
    });
  } catch (error) {
    console.error("Update delivery order status error:", error);
    return errorResponse("Unable to update delivery status.", 500);
  }
}
