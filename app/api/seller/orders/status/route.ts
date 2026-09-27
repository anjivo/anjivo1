import { NextRequest, NextResponse } from "next/server";
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/firebase-admin-auth";

type SellerFulfillmentStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

type RequestBody = {
  orderId?: string;
  status?: SellerFulfillmentStatus;
  courierName?: string;
  courier?: string;
  trackingNumber?: string;
  awbNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string | number | null;
};

const ALLOWED_STATUSES: SellerFulfillmentStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

/*
 * Seller status flow.
 *
 * Sellers cannot arbitrarily jump backwards in the fulfillment flow.
 * pending -> confirmed -> processing -> packed -> shipped
 * -> out_for_delivery -> delivered
 *
 * Cancellation/return/refund are handled as controlled terminal states.
 */
const NEXT_STATUSES: Record<
  SellerFulfillmentStatus,
  SellerFulfillmentStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "returned"],
  out_for_delivery: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: ["refunded"],
  refunded: [],
};

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeEstimatedDelivery(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  return null;
}

function isAllowedStatus(
  value: unknown
): value is SellerFulfillmentStatus {
  return (
    typeof value === "string" &&
    ALLOWED_STATUSES.includes(
      value as SellerFulfillmentStatus
    )
  );
}

function canTransition(
  current: SellerFulfillmentStatus,
  next: SellerFulfillmentStatus
): boolean {
  if (current === next) {
    return true;
  }

  return NEXT_STATUSES[current].includes(
    next
  );
}

function getCurrentFulfillmentStatus(
  data: DocumentData
): SellerFulfillmentStatus {
  if (
    isAllowedStatus(
      data.fulfillmentStatus
    )
  ) {
    return data.fulfillmentStatus;
  }

  /*
   * Backward compatibility for orders that
   * were created before fulfillmentStatus
   * was introduced.
   */
  if (
    isAllowedStatus(data.orderStatus)
  ) {
    return data.orderStatus;
  }

  if (
    isAllowedStatus(data.status)
  ) {
    return data.status;
  }

  return "pending";
}

function getSellerOrderItems(
  data: DocumentData,
  sellerId: string
): DocumentData[] {
  const items = Array.isArray(data.items)
    ? data.items
    : [];

  return items.filter((item) => {
    if (
      typeof item !== "object" ||
      item === null
    ) {
      return false;
    }

    const itemData =
      item as DocumentData;

    return (
      stringValue(
        itemData.sellerId
      ) === sellerId
    );
  }) as DocumentData[];
}

function getSellerIds(
  data: DocumentData
): string[] {
  if (!Array.isArray(data.sellerIds)) {
    return [];
  }

  return data.sellerIds
    .filter(
      (value): value is string =>
        typeof value === "string"
    )
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * Authentication:
     * sellerId is ALWAYS derived from the
     * verified Firebase ID token.
     */
    const decodedToken =
      await verifyIdToken(
        request.headers.get(
          "authorization"
        )
      );

    const sellerId =
      decodedToken.uid;

    if (!sellerId) {
      return jsonError(
        "Seller authentication failed.",
        401
      );
    }

    const body =
      (await request.json()) as RequestBody;

    const orderId =
      stringValue(body.orderId);

    const nextStatus =
      body.status;

    const courierName = stringValue(body.courierName || body.courier);
    const trackingNumber = stringValue(body.trackingNumber || body.awbNumber);
    const trackingUrl = stringValue(body.trackingUrl);
    const estimatedDelivery = normalizeEstimatedDelivery(body.estimatedDelivery);

    if (trackingUrl && !validHttpUrl(trackingUrl)) {
      return jsonError("Tracking URL must be a valid HTTP or HTTPS URL.", 400);
    }

    if (body.estimatedDelivery && !estimatedDelivery) {
      return jsonError("Estimated delivery must be a valid date.", 400);
    }

    if (!orderId) {
      return jsonError(
        "Order ID is required.",
        400
      );
    }

    if (
      !isAllowedStatus(nextStatus)
    ) {
      return jsonError(
        "Invalid seller fulfillment status.",
        400
      );
    }

    /*
     * Verify the seller account itself.
     */
    const sellerUserRef =
      adminDb
        .collection("users")
        .doc(sellerId);

    const sellerUserSnapshot =
      await sellerUserRef.get();

    if (
      !sellerUserSnapshot.exists
    ) {
      return jsonError(
        "Seller account not found.",
        404
      );
    }

    const sellerUser =
      sellerUserSnapshot.data() || {};

    if (
      sellerUser.role !==
      "SELLER"
    ) {
      return jsonError(
        "Only sellers can update seller orders.",
        403
      );
    }

    if (
      sellerUser.sellerStatus !==
      "approved"
    ) {
      return jsonError(
        "Seller account is not approved.",
        403
      );
    }

    const orderRef =
      adminDb
        .collection("orders")
        .doc(orderId);

    await adminDb.runTransaction(
      async (transaction) => {
        const orderSnapshot =
          await transaction.get(
            orderRef
          );

        if (
          !orderSnapshot.exists
        ) {
          throw new Error(
            "ORDER_NOT_FOUND"
          );
        }

        const orderData =
          orderSnapshot.data() || {};

        /*
         * First ownership check:
         * order sellerIds must contain this seller.
         */
        const sellerIds =
          getSellerIds(orderData);

        if (
          !sellerIds.includes(
            sellerId
          )
        ) {
          throw new Error(
            "SELLER_NOT_ASSIGNED"
          );
        }

        /*
         * Second ownership check:
         * at least one actual line item must
         * belong to this seller.
         */
        const sellerItems =
          getSellerOrderItems(
            orderData,
            sellerId
          );

        if (
          sellerItems.length === 0
        ) {
          throw new Error(
            "SELLER_ITEMS_NOT_FOUND"
          );
        }

        /*
         * Status belongs to this seller's fulfillment. For multi-seller
         * orders, keep seller-specific status/tracking under sellerFulfillment
         * on the parent order and in the sellerOrders mirror.
         */
        const sellerOrderRef = adminDb
          .collection("sellerOrders")
          .doc(`${orderId}_${sellerId}`);

        const sellerOrderSnapshot = await transaction.get(sellerOrderRef);
        const sellerOrderData = sellerOrderSnapshot.exists
          ? sellerOrderSnapshot.data() || {}
          : {};

        const currentStatus = getCurrentFulfillmentStatus(
          sellerOrderSnapshot.exists ? sellerOrderData : orderData
        );

        if (!canTransition(currentStatus, nextStatus)) {
          throw new Error(
            `INVALID_TRANSITION:${currentStatus}:${nextStatus}`
          );
        }

        const now = FieldValue.serverTimestamp();
        const trackingUpdates: DocumentData = {};

        // Only supplied tracking fields are updated; omitted values are preserved.
        if (courierName) trackingUpdates.courierName = courierName;
        if (trackingNumber) {
          trackingUpdates.trackingNumber = trackingNumber;
          trackingUpdates.awbNumber = trackingNumber;
        }
        if (trackingUrl) trackingUpdates.trackingUrl = trackingUrl;
        if (estimatedDelivery) {
          trackingUpdates.estimatedDelivery = estimatedDelivery;
        }

        const sellerUpdate: DocumentData = {
          fulfillmentStatus: nextStatus,
          updatedAt: now,
          ...trackingUpdates,
        };

        if (nextStatus === "shipped") {
          sellerUpdate.shippedAt = now;
        }
        if (nextStatus === "delivered") {
          sellerUpdate.deliveredAt = now;
        }

        if (sellerOrderSnapshot.exists) {
          transaction.update(sellerOrderRef, sellerUpdate);
        } else {
          transaction.set(sellerOrderRef, {
            orderId,
            sellerId,
            items: sellerItems,
            fulfillmentStatus: nextStatus,
            createdAt: now,
            ...sellerUpdate,
          });
        }

        // Keep a seller-specific tracking record on the canonical order.
        // This avoids one seller overwriting another seller's shipment details.
        const parentSellerUpdate: DocumentData = {
          [`sellerFulfillment.${sellerId}.fulfillmentStatus`]: nextStatus,
          [`sellerFulfillment.${sellerId}.updatedAt`]: now,
        };

        for (const [key, value] of Object.entries(trackingUpdates)) {
          parentSellerUpdate[`sellerFulfillment.${sellerId}.${key}`] = value;
        }

        if (nextStatus === "shipped") {
          parentSellerUpdate[`sellerFulfillment.${sellerId}.shippedAt`] = now;
        }
        if (nextStatus === "delivered") {
          parentSellerUpdate[`sellerFulfillment.${sellerId}.deliveredAt`] = now;
        }

        // A parent-level status/tracking mirror is safe only for a single-seller order.
        if (sellerIds.length === 1 && sellerIds[0] === sellerId) {
          parentSellerUpdate.fulfillmentStatus = nextStatus;
          parentSellerUpdate.updatedAt = now;
          Object.assign(parentSellerUpdate, trackingUpdates);
          if (nextStatus === "shipped") parentSellerUpdate.shippedAt = now;
          if (nextStatus === "delivered") parentSellerUpdate.deliveredAt = now;
        }

        transaction.update(orderRef, parentSellerUpdate);

        /*
         * Audit log.
         */
        const auditRef =
          adminDb
            .collection("auditLogs")
            .doc();

        transaction.set(
          auditRef,
          {
            action:
              "SELLER_ORDER_STATUS_UPDATED",
            entityType: "ORDER",
            entityId: orderId,
            sellerId,
            previousStatus:
              currentStatus,
            newStatus:
              nextStatus,
            courierName: courierName || null,
            trackingNumber: trackingNumber || null,
            trackingUrl: trackingUrl || null,
            estimatedDelivery: estimatedDelivery || null,
            affectedItemCount:
              sellerItems.length,
            actorUid: sellerId,
            actorRole: "SELLER",
            createdAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    return NextResponse.json(
      {
        success: true,
        orderId,
        sellerId,
        fulfillmentStatus:
          nextStatus,
        courierName: courierName || null,
        trackingNumber: trackingNumber || null,
        trackingUrl: trackingUrl || null,
        estimatedDelivery: estimatedDelivery || null,
        message:
          "Seller order status updated successfully.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Seller order status API error:",
      error
    );

    if (
      error instanceof Error
    ) {
      if (
        error.message ===
        "ORDER_NOT_FOUND"
      ) {
        return jsonError(
          "Order not found.",
          404
        );
      }

      if (
        error.message ===
        "SELLER_NOT_ASSIGNED"
      ) {
        return jsonError(
          "This order is not assigned to your seller account.",
          403
        );
      }

      if (
        error.message ===
        "SELLER_ITEMS_NOT_FOUND"
      ) {
        return jsonError(
          "No products belonging to your seller account were found in this order.",
          403
        );
      }

      if (
        error.message.startsWith(
          "INVALID_TRANSITION:"
        )
      ) {
        const parts =
          error.message.split(":");

        const current =
          parts[1] || "pending";

        const next =
          parts[2] || "";

        return jsonError(
          `Invalid status transition: ${current} → ${next}.`,
          400
        );
      }
    }

    /*
     * Do not expose internal Firebase/Admin
     * errors to the client.
     */
    return jsonError(
      "Unable to update seller order status.",
      500
    );
  }
}
