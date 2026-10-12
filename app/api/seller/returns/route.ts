import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/firebase-admin-auth";

export const runtime = "nodejs";

type SellerReturn = DocumentData & {
  id: string;
  returnStatus?: unknown;
  status?: unknown;
  createdAt?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status },
  );
}

function safeDate(value: unknown): number {
  try {
    if (
      value &&
      typeof value === "object" &&
      "toMillis" in value &&
      typeof (value as { toMillis?: unknown }).toMillis === "function"
    ) {
      const result = (
        value as { toMillis: () => number }
      ).toMillis();

      return Number.isFinite(result) ? result : 0;
    }

    if (value instanceof Date) {
      return Number.isFinite(value.getTime())
        ? value.getTime()
        : 0;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  } catch {
    return 0;
  }

  return 0;
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "requested")
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");
}

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyIdToken(
      request.headers.get("authorization"),
    );

    const sellerId = decodedToken.uid;

    if (!sellerId) {
      return jsonError("Seller authentication failed.", 401);
    }

    const sellerSnapshot = await adminDb
      .collection("users")
      .doc(sellerId)
      .get();

    if (!sellerSnapshot.exists) {
      return jsonError("Seller account not found.", 404);
    }

    const seller = sellerSnapshot.data() ?? {};

    if (seller.role !== "SELLER") {
      return jsonError(
        "Only sellers can view return requests.",
        403,
      );
    }

    if (seller.sellerStatus !== "approved") {
      return jsonError(
        "Seller account is not approved.",
        403,
      );
    }

    const statusFilter = normalizeStatus(
      request.nextUrl.searchParams.get("status") || "all",
    );

    const validStatuses = new Set([
      "all",
      "requested",
      "approved",
      "rejected",
      "in_transit",
      "received",
      "qc_pending",
      "qc_passed",
      "qc_failed",
      "completed",
      "cancelled",
      "canceled",
    ]);

    if (!validStatuses.has(statusFilter)) {
      return jsonError("Invalid return status filter.", 400);
    }

    const snapshot = await adminDb
      .collection("returns")
      .where("sellerId", "==", sellerId)
      .get();

    const returnDocuments: SellerReturn[] =
      snapshot.docs.map(
        (document): SellerReturn => ({
          ...document.data(),
          id: document.id,
        }),
      );

    const returns = returnDocuments
      .filter((item) => {
        if (statusFilter === "all") {
          return true;
        }

        return (
          normalizeStatus(
            item.returnStatus ?? item.status ?? "requested",
          ) === statusFilter
        );
      })
      .sort(
        (a, b) =>
          safeDate(b.createdAt) - safeDate(a.createdAt),
      );

    return NextResponse.json({
      success: true,
      returns,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    const unauthorized =
      /token|authorization|unauthenticated|expired/i.test(
        message,
      );

    if (!unauthorized) {
      console.error("Get seller returns error:", error);
    }

    return jsonError(
      unauthorized
        ? "Please sign in again."
        : "Unable to load return requests.",
      unauthorized ? 401 : 500,
    );
  }
}
