import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const RETURN_STATUSES = new Set([
  "requested",
  "approved",
  "rejected",
  "pickup_pending",
  "picked_up",
  "received",
  "qc_pending",
  "qc_passed",
  "qc_failed",
  "refund_pending",
  "refund_initiated",
  "completed",
  "disputed",
]);

const REFUND_STATUSES = new Set([
  "not_applicable",
  "pending",
  "approved",
  "initiated",
  "completed",
  "failed",
]);

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: responseError("Authentication required.", 401) };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authorization.slice(7).trim());
  } catch {
    return { error: responseError("Invalid or expired token.", 401) };
  }

  const userSnapshot = await adminDb.collection("users").doc(decodedToken.uid).get();
  const user = userSnapshot.data() ?? {};
  const role = String(user.role ?? "").trim().toLowerCase();
  const accountStatus = String(user.accountStatus ?? "").trim().toLowerCase();
  const allowed =
    userSnapshot.exists &&
    (role === "admin" ||
      role === "superadmin" ||
      decodedToken.admin === true) &&
    accountStatus !== "blocked";

  if (!allowed) {
    return { error: responseError("Admin access required.", 403) };
  }

  return { uid: decodedToken.uid };
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
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function serializeReturn(id: string, data: DocumentData) {
  return {
    ...data,
    id,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// GET /api/admin/returns — list return requests for an authenticated admin.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    // Avoid requiring a composite index and include legacy documents without createdAt.
    const snapshot = await adminDb
      .collection("returns")
      .limit(500)
      .get();

    return NextResponse.json({
      success: true,
      returns: snapshot.docs.map((item) => serializeReturn(item.id, item.data())),
      count: snapshot.size,
    });
  } catch (error) {
    console.error("Admin list returns error:", error);
    return responseError(
      "Returns load nahi ho paaye. Check returns collection and createdAt index/fields.",
      500,
    );
  }
}

// PATCH /api/admin/returns
// Body: { returnId, action: "return_status" | "refund_status" | "dispute", value }
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return responseError("Invalid JSON body.", 400);
  }

  const returnId = safeText(body.returnId);
  const action = safeText(body.action);
  if (!returnId || returnId.length > 180 || returnId.includes("/")) {
    return responseError("Valid returnId is required.", 400);
  }
  if (!["return_status", "refund_status", "dispute"].includes(action)) {
    return responseError("Unsupported return action.", 400);
  }

  const ref = adminDb.collection("returns").doc(returnId);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return { ok: false as const, status: 404, error: "Return request not found." };
      }

      const current = snapshot.data() ?? {};
      const update: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
        lastUpdatedBy: auth.uid,
      };
      let auditAction = "RETURN_UPDATED";
      let details: Record<string, unknown> = { action };

      if (action === "return_status") {
        const value = safeText(body.value);
        if (!RETURN_STATUSES.has(value)) {
          return { ok: false as const, status: 400, error: "Invalid return status." };
        }

        // A completed return or rejected request cannot be reopened via a simple status edit.
        const existing = safeText(current.returnStatus || current.status).toLowerCase();
        if (
          (existing === "completed" || existing === "rejected") &&
          value !== existing
        ) {
          return {
            ok: false as const,
            status: 409,
            error: "Completed/rejected returns require a separate reviewed process to change.",
          };
        }

        update.returnStatus = value;
        if (value === "qc_passed" || value === "qc_failed") update.qcStatus = value;
        auditAction = "RETURN_STATUS_UPDATED";
        details = { previousStatus: existing || null, newStatus: value };
      } else if (action === "refund_status") {
        const value = safeText(body.value);
        if (!REFUND_STATUSES.has(value)) {
          return { ok: false as const, status: 400, error: "Invalid refund status." };
        }

        const existingReturnStatus = safeText(current.returnStatus || current.status).toLowerCase();
        if (value === "completed" && existingReturnStatus !== "qc_passed" &&
            existingReturnStatus !== "refund_pending" &&
            existingReturnStatus !== "refund_initiated" &&
            existingReturnStatus !== "completed") {
          return {
            ok: false as const,
            status: 409,
            error: "QC must pass or refund must be in the refund stage before completion.",
          };
        }

        update.refundStatus = value;
        if (value === "completed") update.returnStatus = "completed";
        if (value === "initiated") update.returnStatus = "refund_initiated";
        if (value === "approved") update.returnStatus = "refund_pending";
        auditAction = "REFUND_STATUS_UPDATED";
        details = { previousRefundStatus: safeText(current.refundStatus) || null, newRefundStatus: value };
      } else {
        if (typeof body.value !== "boolean") {
          return { ok: false as const, status: 400, error: "Dispute value must be true or false." };
        }
        const nextValue = body.value;
        update.dispute = nextValue;
        if (nextValue) {
          update.returnStatus = "disputed";
          update.disputeFlaggedAt = FieldValue.serverTimestamp();
          update.disputeFlaggedBy = auth.uid;
        } else {
          update.disputeResolvedAt = FieldValue.serverTimestamp();
          update.disputeResolvedBy = auth.uid;
          // Keep the return status unchanged; clearing a flag must not invent a previous status.
        }
        auditAction = nextValue ? "RETURN_DISPUTE_FLAGGED" : "RETURN_DISPUTE_CLEARED";
        details = { dispute: nextValue };
      }

      transaction.update(ref, update);

      const auditRef = adminDb.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        action: auditAction,
        entityType: "return",
        entityId: returnId,
        actorUid: auth.uid,
        details,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true as const };
    });

    if (!result.ok) return responseError(result.error, result.status);

    const updated = await ref.get();
    return NextResponse.json({
      success: true,
      return: serializeReturn(updated.id, updated.data() ?? {}),
    });
  } catch (error) {
    console.error("Admin update return error:", error);
    return responseError("Return update failed. Check server logs.", 500);
  }
}
