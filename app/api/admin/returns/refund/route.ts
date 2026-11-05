
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const CASHFREE_API_VERSION = "2022-09-01";

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

async function requireAdmin(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return {
      error: fail("Authentication required.", 401),
    };
  }

  let decoded;

  try {
    decoded = await adminAuth.verifyIdToken(
      header.slice(7).trim(),
    );
  } catch {
    return {
      error: fail("Invalid or expired token.", 401),
    };
  }

  const user = await adminDb
    .collection("users")
    .doc(decoded.uid)
    .get();

  const data = user.data() ?? {};
  const role = String(data.role ?? "").toLowerCase();

  if (
    !user.exists ||
    !(
      role === "admin" ||
      role === "superadmin" ||
      decoded.admin === true
    ) ||
    String(data.accountStatus ?? "").toLowerCase() === "blocked"
  ) {
    return {
      error: fail("Admin access required.", 403),
    };
  }

  return { uid: decoded.uid };
}

function cashfreeBaseUrl() {
  return process.env.CASHFREE_ENV === "PRODUCTION"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

async function cashfreeRequest(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  idempotencyKey?: string,
) {
  const clientId =
    process.env.CASHFREE_CLIENT_ID?.trim();

  const clientSecret =
    process.env.CASHFREE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Cashfree credentials are not configured.",
    );
  }

  const response = await fetch(
    `${cashfreeBaseUrl()}${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": clientId,
        "x-client-secret": clientSecret,

        ...(idempotencyKey
          ? { "x-idempotency-key": idempotencyKey }
          : {}),
      },

      ...(body
        ? { body: JSON.stringify(body) }
        : {}),

      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : `Cashfree request failed (${response.status}).`;

    throw new Error(message);
  }

  return payload as Record<string, unknown>;
}

// POST /api/admin/returns/refund
//
// Initiate:
// { returnId, action: "initiate" }
//
// Sync:
// { returnId, action: "sync" }

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);

  if ("error" in auth) {
    return auth.error;
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const returnId =
    typeof body.returnId === "string"
      ? body.returnId.trim()
      : "";

  const action =
    typeof body.action === "string"
      ? body.action
      : "initiate";

  if (
    !returnId ||
    returnId.length > 180 ||
    returnId.includes("/")
  ) {
    return fail("Valid returnId is required.", 400);
  }

  if (
    action !== "initiate" &&
    action !== "sync"
  ) {
    return fail("Unsupported refund action.", 400);
  }

  const returnRef = adminDb
    .collection("returns")
    .doc(returnId);

  try {
    const returnSnapshot = await returnRef.get();

    if (!returnSnapshot.exists) {
      return fail("Return request not found.", 404);
    }

    const returnData = returnSnapshot.data() ?? {};

    const returnStatus = String(
      returnData.returnStatus ?? returnData.status ?? "",
    ).toLowerCase();

    const refundStatus = String(
      returnData.refundStatus ?? "pending",
    ).toLowerCase();

    if (
      ![
        "qc_passed",
        "refund_pending",
        "refund_initiated",
        "completed",
      ].includes(returnStatus)
    ) {
      return fail(
        "Return QC must pass before a Cashfree refund can be processed.",
        409,
      );
    }

    if (refundStatus === "completed") {
      return NextResponse.json({
        success: true,
        refundStatus,
        returnStatus,
        message: "Refund is already completed.",
      });
    }

    const orderId = String(returnData.orderId ?? "");

    if (!orderId) {
      return fail(
        "Return request has no linked order.",
        409,
      );
    }

    const orderSnapshot = await adminDb
      .collection("orders")
      .doc(orderId)
      .get();

    if (!orderSnapshot.exists) {
      return fail("Linked order not found.", 404);
    }

    const order = orderSnapshot.data() ?? {};

    const paymentMethod = String(
      order.paymentMethod ?? "",
    ).toUpperCase();

    const provider = String(
      order.paymentProvider ?? "",
    ).toUpperCase();

    if (
      paymentMethod !== "ONLINE" ||
      provider !== "CASHFREE"
    ) {
      return fail(
        "Automatic Cashfree refund is only available for orders paid online through Cashfree. COD and other payment methods need a separately verified refund method.",
        409,
      );
    }

    if (
      String(order.paymentStatus ?? "").toUpperCase() !==
      "PAID"
    ) {
      return fail(
        "The original order payment is not confirmed as paid.",
        409,
      );
    }

    const cashfreeOrderId = String(
      order.paymentIntentId ??
        order.cashfreeOrderId ??
        "",
    );

    if (!cashfreeOrderId) {
      return fail(
        "Cashfree payment order reference is missing on this order.",
        409,
      );
    }

    const refundId =
      `ANJIVO${returnId
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(-24)}`;

    let refund: Record<string, unknown>;

    if (
      action === "sync" ||
      returnData.cashfreeRefundId
    ) {
      const storedRefundId = String(
        returnData.cashfreeRefundId ?? refundId,
      );

      refund = await cashfreeRequest(
        `/orders/${encodeURIComponent(cashfreeOrderId)}/refunds/${encodeURIComponent(storedRefundId)}`,
        "GET",
      );
    } else {
      const refundAmount = Number(
        returnData.refundAmount ||
          returnData.amount,
      );

      const orderTotal = Number(
        order.total ?? order.grandTotal ?? 0,
      );

      if (
        !Number.isFinite(refundAmount) ||
        refundAmount <= 0 ||
        !Number.isFinite(orderTotal) ||
        refundAmount > orderTotal
      ) {
        return fail(
          "Refund amount is invalid or exceeds the original order total.",
          409,
        );
      }

      const relatedReturns = await adminDb
        .collection("returns")
        .where("orderId", "==", orderId)
        .get();

      const alreadyRefundedOrProcessing =
        relatedReturns.docs.reduce((sum, doc) => {
          if (doc.id === returnId) return sum;

          const data = doc.data();

          const status = String(
            data.refundStatus ?? "",
          ).toLowerCase();

          return ["initiated", "completed"].includes(status)
            ? sum +
                Math.max(
                  0,
                  Number(
                    data.refundAmount ||
                      data.amount ||
                      0,
                  ),
                )
            : sum;
        }, 0);

      if (
        alreadyRefundedOrProcessing + refundAmount >
        orderTotal + 0.009
      ) {
        return fail(
          "This refund would exceed the remaining paid amount for the order.",
          409,
        );
      }

      refund = await cashfreeRequest(
        `/orders/${encodeURIComponent(cashfreeOrderId)}/refunds`,
        "POST",
        {
          refund_id: refundId,

          refund_amount:
            Math.round(refundAmount * 100) / 100,

          refund_note: `ANJIVO return ${returnId}`,

          refund_speed: "STANDARD",
        },
        `anjivo-return-${returnId}`,
      );
    }

    const providerStatus = String(
      refund.refund_status ?? "PENDING",
    ).toUpperCase();

    const nextRefundStatus =
      providerStatus === "SUCCESS"
        ? "completed"
        : ["FAILED", "CANCELLED"].includes(providerStatus)
          ? "failed"
          : "initiated";

    const refundAmount = Number(
      refund.refund_amount ??
        returnData.refundAmount ??
        returnData.amount ??
        0,
    );

    const providerRefundId = String(
      refund.refund_id ??
        returnData.cashfreeRefundId ??
        refundId,
    );

    await adminDb.runTransaction(
      async (transaction) => {
        const latest = await transaction.get(returnRef);

        if (!latest.exists) {
          throw new Error("RETURN_DISAPPEARED");
        }

        const latestData = latest.data() ?? {};

        if (
          String(latestData.refundStatus ?? "").toLowerCase() ===
          "completed"
        ) {
          return;
        }

        transaction.update(returnRef, {
          refundStatus: nextRefundStatus,

          returnStatus:
            nextRefundStatus === "completed"
              ? "completed"
              : nextRefundStatus === "initiated"
                ? "refund_initiated"
                : "refund_pending",

          refundAmount,

          refundProvider: "CASHFREE",

          cashfreeRefundId: providerRefundId,

          cashfreeRefundStatus: providerStatus,

          cashfreeRefundArn: String(
            refund.refund_arn ?? "",
          ),

          cashfreeRefundResponseAt:
            FieldValue.serverTimestamp(),

          updatedAt: FieldValue.serverTimestamp(),

          lastUpdatedBy: auth.uid,
        });

        const auditRef = adminDb
          .collection("auditLogs")
          .doc();

        transaction.set(auditRef, {
          id: auditRef.id,

          action:
            action === "sync"
              ? "CASHFREE_REFUND_STATUS_SYNCED"
              : "CASHFREE_REFUND_INITIATED",

          entityType: "return",

          entityId: returnId,

          actorUid: auth.uid,

          details: {
            refundId: providerRefundId,
            providerStatus,
            refundAmount,
          },

          createdAt: FieldValue.serverTimestamp(),
        });
      },
    );

    const updated = await returnRef.get();

    const updatedData = updated.data() ?? {};

    return NextResponse.json({
      success: true,

      refundStatus: String(
        updatedData.refundStatus ??
          nextRefundStatus,
      ),

      returnStatus: String(
        updatedData.returnStatus ??
          returnStatus,
      ),

      refundId: providerRefundId,

      providerStatus,

      refundAmount,

      refundArn: String(
        refund.refund_arn ?? "",
      ),

      message:
        nextRefundStatus === "completed"
          ? "Cashfree confirms the refund is successful."
          : nextRefundStatus === "failed"
            ? "Cashfree reports the refund failed."
            : "Refund request accepted by Cashfree; final settlement is pending.",
    });
  } catch (error) {
    console.error(
      "Cashfree return refund error:",
      error,
    );

    return fail(
      error instanceof Error
        ? error.message
        : "Unable to process refund.",
      502,
    );
  }
}
