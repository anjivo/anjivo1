
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/firebase-admin-auth";

export const runtime = "nodejs";

const CASHFREE_API_VERSION = "2023-08-01";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Firebase user
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return errorResponse("Authentication required.", 401);
    }

    const decoded = await verifyIdToken(authorization);

    if (!decoded?.uid) {
      return errorResponse("Invalid authentication token.", 401);
    }

    const userId = decoded.uid;

    // 2. Read Cashfree order ID
    let body: { orderId?: unknown };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON request.", 400);
    }

    const orderId =
      typeof body.orderId === "string" ? body.orderId.trim() : "";

    if (
      !orderId ||
      orderId.length > 180 ||
      orderId.includes("/")
    ) {
      return errorResponse("A valid Cashfree orderId is required.", 400);
    }

    // 3. Read server-side payment intent
    const intentRef = adminDb
      .collection("paymentIntents")
      .doc(orderId);

    const intentSnapshot = await intentRef.get();

    if (!intentSnapshot.exists) {
      return errorResponse("Payment intent not found.", 404);
    }

    const intent = intentSnapshot.data();

    if (intent?.userId !== userId) {
      return errorResponse("You cannot verify this payment.", 403);
    }

    // Idempotent response for an already verified payment
    if (
      intent?.paymentStatus === "PAID" ||
      intent?.status === "PAID"
    ) {
      return NextResponse.json({
        success: true,
        verified: true,
        orderId,
        paymentStatus: "PAID",
        message: "Payment is already verified.",
      });
    }

    if (
      intent?.paymentStatus !== "PENDING" &&
      intent?.status !== "PENDING"
    ) {
      return errorResponse("This payment intent is not pending.", 409);
    }

    // 4. Cashfree credentials and environment
    const clientId = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    const isProduction =
      process.env.CASHFREE_ENV === "PRODUCTION";

    if (!clientId || !clientSecret) {
      return errorResponse(
        "Cashfree server configuration is incomplete.",
        500,
      );
    }

    const baseUrl = isProduction
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";

    // 5. Ask Cashfree directly for the payment status
    const cashfreeResponse = await fetch(
      `${baseUrl}/orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
          "x-api-version": CASHFREE_API_VERSION,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!cashfreeResponse.ok) {
      console.error(
        "Cashfree order lookup failed:",
        cashfreeResponse.status,
      );

      return errorResponse(
        "Could not verify payment with Cashfree. Please try again.",
        502,
      );
    }

    const cashfreeOrder = await cashfreeResponse.json();

    // 6. Verify the actual status and amount
    if (cashfreeOrder.order_status !== "PAID") {
      return NextResponse.json(
        {
          success: true,
          verified: false,
          orderId,
          paymentStatus: String(
            cashfreeOrder.order_status ?? "UNKNOWN",
          ),
          message: "Payment has not been confirmed yet.",
        },
        { status: 200 },
      );
    }

    const expectedAmount = Number(intent?.total);
    const paidAmount = Number(cashfreeOrder.order_amount);
    const currency = String(cashfreeOrder.order_currency ?? "");

    if (
      !Number.isFinite(expectedAmount) ||
      expectedAmount <= 0 ||
      !Number.isFinite(paidAmount) ||
      Math.abs(expectedAmount - paidAmount) > 0.009 ||
      currency !== "INR"
    ) {
      console.error("Cashfree payment amount/currency mismatch.", {
        orderId,
        expectedAmount,
        paidAmount,
        currency,
      });

      return errorResponse(
        "Payment details do not match. Please contact support.",
        409,
      );
    }

    // 7. Mark the intent as paid exactly once
    await adminDb.runTransaction(async (transaction) => {
      const latestSnapshot = await transaction.get(intentRef);

      if (!latestSnapshot.exists) {
        throw new Error("PAYMENT_INTENT_NOT_FOUND");
      }

      const latest = latestSnapshot.data();

      if (latest?.userId !== userId) {
        throw new Error("PAYMENT_OWNER_MISMATCH");
      }

      if (
        latest?.paymentStatus === "PAID" ||
        latest?.status === "PAID"
      ) {
        return;
      }

      if (
        latest?.paymentStatus !== "PENDING" &&
        latest?.status !== "PENDING"
      ) {
        throw new Error("PAYMENT_INTENT_NOT_PENDING");
      }

      const latestExpectedAmount = Number(latest?.total);

      if (
        !Number.isFinite(latestExpectedAmount) ||
        Math.abs(latestExpectedAmount - paidAmount) > 0.009
      ) {
        throw new Error("PAYMENT_AMOUNT_MISMATCH");
      }

      transaction.update(intentRef, {
        status: "PAID",
        paymentStatus: "PAID",
        cashfreeStatus: "PAID",
        cashfreePaymentVerifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      verified: true,
      orderId,
      paymentStatus: "PAID",
      message: "Payment verified successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "PAYMENT_INTENT_NOT_FOUND") {
      return errorResponse("Payment intent not found.", 404);
    }

    if (message === "PAYMENT_OWNER_MISMATCH") {
      return errorResponse("Payment ownership check failed.", 403);
    }

    if (message === "PAYMENT_INTENT_NOT_PENDING") {
      return errorResponse("Payment intent is no longer pending.", 409);
    }

    if (message === "PAYMENT_AMOUNT_MISMATCH") {
      return errorResponse("Payment amount mismatch.", 409);
    }

    console.error("Cashfree verification error:", error);

    return errorResponse("Unable to verify payment right now.", 500);
  }
}
