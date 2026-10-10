import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { error: errorResponse("Authentication required.", 401) };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(
      authorization.slice(7).trim(),
    );
  } catch {
    return { error: errorResponse("Invalid or expired token.", 401) };
  }

  const userSnapshot = await adminDb
    .collection("users")
    .doc(decodedToken.uid)
    .get();
  const data = userSnapshot.data() ?? {};
  const role = String(data.role ?? "").trim().toLowerCase();
  const accountStatus = String(data.accountStatus ?? "").trim().toLowerCase();
  const allowed =
    userSnapshot.exists &&
    (role === "admin" || role === "superadmin" || decodedToken.admin === true) &&
    accountStatus !== "blocked";

  if (!allowed) {
    return { error: errorResponse("Admin access required.", 403) };
  }

  return { uid: decodedToken.uid };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isTerminalOrder(data: DocumentData): boolean {
  const candidates = [data.status, data.orderStatus, data.fulfillmentStatus]
    .map((value) => String(value ?? "").trim().toLowerCase());
  return candidates.some((value) =>
    ["cancelled", "canceled", "refunded", "returned", "delivered"].includes(value),
  );
}

/** POST /api/admin/shipping/assign-delivery
 * Body: { orderId: string, deliveryPartnerId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  const orderId = stringValue(body.orderId);
  const deliveryPartnerId = stringValue(body.deliveryPartnerId);
  if (!orderId || orderId.length > 180 || !deliveryPartnerId || deliveryPartnerId.length > 180) {
    return errorResponse("Valid orderId and deliveryPartnerId are required.", 400);
  }

  try {
    const orderRef = adminDb.collection("orders").doc(orderId);
    const partnerRef = adminDb.collection("deliveryPartners").doc(deliveryPartnerId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      const partnerSnapshot = await transaction.get(partnerRef);

      if (!orderSnapshot.exists) {
        return { ok: false as const, status: 404, error: "Order not found." };
      }
      if (!partnerSnapshot.exists) {
        return { ok: false as const, status: 404, error: "Delivery partner not found." };
      }

      const order = orderSnapshot.data() ?? {};
      const partner = partnerSnapshot.data() ?? {};
      if (isTerminalOrder(order)) {
        return {
          ok: false as const,
          status: 409,
          error: "A delivered, cancelled, returned, or refunded order cannot be assigned.",
        };
      }
      if (String(partner.status ?? "").trim().toLowerCase() !== "active") {
        return { ok: false as const, status: 409, error: "Only active delivery partners can be assigned." };
      }
      const partnerName = stringValue(partner.name);
      const partnerPhone = stringValue(partner.phone);
      if (!partnerName || !partnerPhone) {
        return { ok: false as const, status: 409, error: "Delivery partner profile is incomplete." };
      }

      const now = FieldValue.serverTimestamp();
      transaction.update(orderRef, {
        deliveryPartnerId,
        deliveryPartnerName: partnerName,
        deliveryPartnerPhone: partnerPhone,
        deliveryAssignmentStatus: "assigned",
        assignedAt: now,
        assignedBy: auth.uid,
        updatedAt: now,
      });

      const auditRef = adminDb.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        action: "DELIVERY_PARTNER_ASSIGNED",
        entityType: "order",
        entityId: orderId,
        actorUid: auth.uid,
        details: { deliveryPartnerId, deliveryPartnerName: partnerName },
        createdAt: now,
      });

      return {
        ok: true as const,
        orderId,
        deliveryPartnerId,
        deliveryPartnerName: partnerName,
        deliveryPartnerPhone: partnerPhone,
      };
    });

    if (!result.ok) return errorResponse(result.error, result.status);
    return NextResponse.json({ success: true, assignment: result });
  } catch (error) {
    console.error("Assign delivery partner error:", error);
    return errorResponse("Unable to assign delivery partner. Check server logs.", 500);
  }
}
