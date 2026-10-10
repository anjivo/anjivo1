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

async function requireActiveDeliveryPartner(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(
      authorization.slice(7).trim(),
    );
  } catch {
    return {
      error: NextResponse.json(
        { success: false, error: "Invalid or expired token." },
        { status: 401 },
      ),
    };
  }

  const partnerSnapshot = await adminDb
    .collection("deliveryPartners")
    .where("authUid", "==", decodedToken.uid)
    .limit(1)
    .get();

  if (partnerSnapshot.empty) {
    return {
      error: NextResponse.json(
        { success: false, error: "Delivery partner profile not found." },
        { status: 403 },
      ),
    };
  }

  const partnerDoc = partnerSnapshot.docs[0];
  const partnerData = partnerDoc.data();

  if (partnerData.status !== "active") {
    return {
      error: NextResponse.json(
        { success: false, error: "Your delivery partner account is inactive." },
        { status: 403 },
      ),
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
    return (value as { toDate: () => Date }).toDate().toISOString();
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
    total: Number(data.total ?? 0),
    paymentMethod: String(data.paymentMethod ?? ""),
    paymentStatus: String(data.paymentStatus ?? "PENDING"),
    status: String(data.status ?? data.orderStatus ?? "PLACED").toLowerCase(),
    orderStatus: String(data.orderStatus ?? data.status ?? "PLACED").toLowerCase(),
    fulfillmentStatus: String(data.fulfillmentStatus ?? "PENDING").toLowerCase(),
    deliveryAssignmentStatus: String(data.deliveryAssignmentStatus ?? "assigned").toLowerCase(),
    deliveryPartnerId: String(data.deliveryPartnerId ?? ""),
    deliveryPartnerName: String(data.deliveryPartnerName ?? ""),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
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
    return NextResponse.json(
      { success: false, error: "Unable to load assigned orders." },
      { status: 500 },
    );
  }
}

// PATCH: Allow a partner to update delivery progress for their own assigned order.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireActiveDeliveryPartner(request);
    if ("error" in auth) return auth.error;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const requestedStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const allowedStatuses = ["shipped", "out_for_delivery", "delivered"];

    if (!orderId || !allowedStatuses.includes(requestedStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid orderId and status (shipped, out_for_delivery, delivered) are required.",
        },
        { status: 400 },
      );
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 },
      );
    }

    const orderData = orderSnapshot.data() ?? {};
    if (orderData.deliveryPartnerId !== auth.partner.partnerId) {
      return NextResponse.json(
        { success: false, error: "This order is not assigned to your account." },
        { status: 403 },
      );
    }

    const currentStatus = String(orderData.status ?? orderData.orderStatus ?? "placed").toLowerCase();
    if (currentStatus === "delivered" && requestedStatus !== "delivered") {
      return NextResponse.json(
        { success: false, error: "A delivered order cannot be moved back to an earlier status." },
        { status: 409 },
      );
    }

    const assignmentStatus =
      requestedStatus === "shipped"
        ? "picked_up"
        : requestedStatus === "out_for_delivery"
          ? "out_for_delivery"
          : "delivered";

    await orderRef.update({
      status: requestedStatus,
      orderStatus: requestedStatus,
      fulfillmentStatus: requestedStatus,
      deliveryAssignmentStatus: assignmentStatus,
      deliveryStatusUpdatedAt: FieldValue.serverTimestamp(),
      deliveryStatusUpdatedBy: auth.partner.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedSnapshot = await orderRef.get();
    return NextResponse.json({
      success: true,
      order: serializeOrder(updatedSnapshot.id, updatedSnapshot.data() ?? {}),
    });
  } catch (error) {
    console.error("Update delivery order status error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to update delivery status." },
      { status: 500 },
    );
  }
}
