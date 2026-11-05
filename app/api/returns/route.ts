
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type AuthResult =
  | { uid: string }
  | { error: NextResponse };

type ReturnDocument = DocumentData & {
  id: string;
  orderId?: unknown;
  productId?: unknown;
  customerId?: unknown;
  returnStatus?: unknown;
  refundStatus?: unknown;
  status?: unknown;
  createdAt?: unknown;
};

function responseError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

async function requireUser(
  request: NextRequest,
): Promise<AuthResult> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: responseError("Authentication required.", 401),
    };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return {
      error: responseError("Authentication required.", 401),
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return {
      error: responseError("Invalid or expired token.", 401),
    };
  }
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");
}

function isDelivered(order: DocumentData): boolean {
  const statuses = [
    normalizeStatus(order.status),
    normalizeStatus(order.orderStatus),
    normalizeStatus(order.fulfillmentStatus),
  ];

  if (
    statuses.some((status) =>
      ["cancelled", "canceled", "returned", "refunded"].includes(status),
    )
  ) {
    return false;
  }

  return statuses.some((status) =>
    ["delivered", "complete", "completed"].includes(status),
  );
}

function toIso(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      const date = (
        value as { toDate: () => Date }
      ).toDate();

      return Number.isNaN(date.getTime())
        ? null
        : date.toISOString();
    } catch {
      return null;
    }
  }

  return null;
}

function toMillis(value: unknown): number | null {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const result = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(result) ? result : null;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const result = (value as { toDate: () => Date }).toDate().getTime();
    return Number.isFinite(result) ? result : null;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value).getTime();
    return Number.isFinite(result) ? result : null;
  }

  return null;
}

const RETURN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function deliveredAtMillis(order: DocumentData): number | null {
  const direct = toMillis(order.deliveredAt);

  if (direct !== null) return direct;

  const fulfillment = order.sellerFulfillment;

  if (fulfillment && typeof fulfillment === "object") {
    const dates = Object.values(
      fulfillment as Record<string, unknown>,
    )
      .map((entry) =>
        entry && typeof entry === "object"
          ? toMillis(
              (entry as Record<string, unknown>).deliveredAt,
            )
          : null,
      )
      .filter((value): value is number => value !== null);

    if (dates.length) return Math.max(...dates);
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

// GET /api/returns?orderId=...
// Returns only the signed-in customer's return requests.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const orderId = String(
      request.nextUrl.searchParams.get("orderId") ?? "",
    ).trim();

    if (
      !orderId ||
      orderId.length > 180 ||
      orderId.includes("/")
    ) {
      return responseError("A valid orderId is required.", 400);
    }

    const orderSnapshot = await adminDb
      .collection("orders")
      .doc(orderId)
      .get();

    if (!orderSnapshot.exists) {
      return responseError("Order not found.", 404);
    }

    const order = orderSnapshot.data() ?? {};

    const ownerId = String(
      order.customerId ?? order.userId ?? "",
    );

    if (ownerId !== auth.uid) {
      return responseError(
        "You are not allowed to view returns for this order.",
        403,
      );
    }

    const snapshot = await adminDb
      .collection("returns")
      .where("orderId", "==", orderId)
      .limit(100)
      .get();

    const returnDocuments: ReturnDocument[] = snapshot.docs.map(
      (doc) => ({
        ...doc.data(),
        id: doc.id,
      }),
    );

    const returns = returnDocuments
      .filter(
        (item) => String(item.customerId ?? "") === auth.uid,
      )
      .map((item) => ({
        id: item.id,
        orderId: String(item.orderId ?? ""),
        productId: String(item.productId ?? ""),
        returnStatus: String(
          item.returnStatus ?? item.status ?? "requested",
        ),
        refundStatus: String(item.refundStatus ?? "pending"),
        createdAt: toIso(item.createdAt),
        deliveredAt: toIso(item.deliveredAt),
        returnDeadlineAt: toIso(item.returnDeadlineAt),
        refundAmount: Number(item.refundAmount ?? 0),
        reason: String(item.reason ?? ""),
        quantity: Number(item.quantity ?? 0),
        productName: String(item.productName ?? "Product"),
        images: Array.isArray(item.images) ? item.images : [],
      }));

    return NextResponse.json({
      success: true,
      returns,
    });
  } catch (error) {
    console.error("Get customer returns error:", error);

    return responseError("Unable to load return requests.", 500);
  }
}

// POST /api/returns
// Creates a return request for an eligible delivered product.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);

    if ("error" in auth) {
      return auth.error;
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return responseError("Invalid JSON body.", 400);
    }

    const orderId =
      typeof body.orderId === "string"
        ? body.orderId.trim()
        : "";

    const productId =
      typeof body.productId === "string"
        ? body.productId.trim()
        : "";

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const quantity = Number(body.quantity);

    if (
      !orderId ||
      orderId.length > 180 ||
      orderId.includes("/") ||
      !productId ||
      productId.length > 180 ||
      productId.includes("/") ||
      !allowedReasons.has(reason) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      description.length > 1000
    ) {
      return responseError(
        "Please provide a valid order, product, reason, quantity and description.",
        400,
      );
    }

    const orderRef = adminDb
      .collection("orders")
      .doc(orderId);

    const result = await adminDb.runTransaction(
      async (transaction) => {
        const orderSnapshot = await transaction.get(orderRef);

        if (!orderSnapshot.exists) {
          return {
            ok: false as const,
            status: 404,
            error: "Order not found.",
          };
        }

        const order = orderSnapshot.data() ?? {};

        const ownerId = String(
          order.customerId ?? order.userId ?? "",
        );

        if (ownerId !== auth.uid) {
          return {
            ok: false as const,
            status: 403,
            error: "You are not allowed to return items from this order.",
          };
        }

        if (!isDelivered(order)) {
          return {
            ok: false as const,
            status: 409,
            error: "A return can only be requested after delivery.",
          };
        }

        const deliveredAt = deliveredAtMillis(order);

        if (deliveredAt === null) {
          return {
            ok: false as const,
            status: 409,
            error: "Delivery timestamp is missing for this order. Please contact ANJIVO support to verify eligibility.",
          };
        }

        const returnDeadlineAt =
          deliveredAt + RETURN_WINDOW_MS;

        if (Date.now() > returnDeadlineAt) {
          return {
            ok: false as const,
            status: 409,
            error: "The 72-hour return window has expired. Return requests must be submitted within 72 hours of delivery.",
          };
        }

        const items: Record<string, unknown>[] =
          Array.isArray(order.items)
            ? order.items.filter(
                (entry: unknown): entry is Record<string, unknown> =>
                  entry !== null &&
                  typeof entry === "object" &&
                  !Array.isArray(entry),
              )
            : [];

        const item = items.find(
          (candidate) =>
            String(
              candidate.productId ?? candidate.id ?? "",
            ) === productId,
        );

        if (!item) {
          return {
            ok: false as const,
            status: 404,
            error: "Product was not found in this order.",
          };
        }

        const orderedQuantity = Number(item.quantity ?? 0);

        if (
          !Number.isSafeInteger(orderedQuantity) ||
          orderedQuantity < 1 ||
          quantity > orderedQuantity
        ) {
          return {
            ok: false as const,
            status: 400,
            error: "Return quantity cannot exceed the purchased quantity.",
          };
        }

        // Check existing requests inside the transaction.
        const existingSnapshot = await transaction.get(
          adminDb
            .collection("returns")
            .where("orderId", "==", orderId),
        );

        const activeReturnStatuses = new Set([
          "requested",
          "approved",
          "pickup_pending",
          "picked_up",
          "received",
          "qc_pending",
          "qc_passed",
          "refund_pending",
          "refund_initiated",
          "disputed",
          "completed",
          "qc_failed",
        ]);

        const alreadyRequestedQuantity =
          existingSnapshot.docs.reduce((total, doc) => {
            const data = doc.data();

            const sameProduct =
              String(data.customerId ?? "") === auth.uid &&
              String(data.productId ?? "") === productId;

            const status = normalizeStatus(
              data.returnStatus ?? data.status,
            );

            return sameProduct && activeReturnStatuses.has(status)
              ? total + Math.max(0, Number(data.quantity ?? 0))
              : total;
          }, 0);

        if (
          alreadyRequestedQuantity + quantity >
          orderedQuantity
        ) {
          return {
            ok: false as const,
            status: 409,
            error: `Only ${Math.max(0, orderedQuantity - alreadyRequestedQuantity)} item(s) remain eligible for return.`,
          };
        }

        const selectedPrice = Number(
          item.selectedPrice ??
            item.unitPrice ??
            item.price ??
            0,
        );

        const lineSubtotal = Number(item.subtotal ?? 0);

        const unitAmount =
          Number.isFinite(selectedPrice) && selectedPrice > 0
            ? selectedPrice
            : Number.isFinite(lineSubtotal) &&
                lineSubtotal > 0 &&
                orderedQuantity > 0
              ? lineSubtotal / orderedQuantity
              : 0;

        const amount =
          Math.round(unitAmount * quantity * 100) / 100;

        const returnRef = adminDb
          .collection("returns")
          .doc();

        const now = FieldValue.serverTimestamp();

        const shippingAddress =
          order.shippingAddress &&
          typeof order.shippingAddress === "object"
            ? order.shippingAddress as Record<string, unknown>
            : {};

        const returnData = {
          id: returnRef.id,
          orderId,
          productId,
          customerId: auth.uid,

          customerName: String(
            shippingAddress.fullName ??
              shippingAddress.name ??
              order.customerName ??
              "",
          ),

          customerEmail: String(order.customerEmail ?? ""),

          customerPhone: String(
            shippingAddress.phone ??
              order.customerPhone ??
              "",
          ),

          sellerId: String(item.sellerId ?? ""),
          sellerName: String(item.sellerName ?? ""),

          productName: String(
            item.name ?? item.productName ?? "Product",
          ),

          quantity,
          amount,

          deliveredAt: new Date(deliveredAt),
          returnDeadlineAt: new Date(returnDeadlineAt),
          returnWindowDays: 3,

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
            returnDeadlineAt: new Date(
              returnDeadlineAt,
            ).toISOString(),
          },
        };
      },
    );

    if (!result.ok) {
      return responseError(result.error, result.status);
    }

    return NextResponse.json(
      {
        success: true,
        returnRequest: result.returnRequest,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create customer return request error:", error);

    return responseError(
      "Unable to create return request.",
      500,
    );
  }
}
