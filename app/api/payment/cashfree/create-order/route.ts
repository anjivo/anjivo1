
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/firebase-admin-auth";

export const runtime = "nodejs";

const CASHFREE_API_VERSION = "2023-08-01";

type ShippingAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the customer.
    const decodedToken = await verifyIdToken(
      request.headers.get("authorization")
    );

    const userId = decodedToken.uid;
    const body = await request.json();

    const items = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return jsonError("Your cart is empty.");
    }

    if (items.length > 100) {
      return jsonError("Too many order items.");
    }

    // 2. Validate the delivery address.
    const rawAddress = body?.shippingAddress;

    if (!rawAddress || typeof rawAddress !== "object") {
      return jsonError("Delivery address is required.");
    }

    const address = rawAddress as ShippingAddress;

    if (
      typeof address.fullName !== "string" ||
      address.fullName.trim().length < 2 ||
      typeof address.phone !== "string" ||
      !/^[6-9]\d{9}$/.test(address.phone.trim()) ||
      typeof address.addressLine1 !== "string" ||
      address.addressLine1.trim().length < 5 ||
      typeof address.city !== "string" ||
      address.city.trim().length < 2 ||
      typeof address.state !== "string" ||
      address.state.trim().length < 2 ||
      typeof address.pincode !== "string" ||
      !/^\d{6}$/.test(address.pincode.trim())
    ) {
      return jsonError("Please enter a valid delivery address.");
    }

    // 3. Require Cashfree credentials.
    // These can be added to .env.local later.
    const clientId = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    const isProduction =
      process.env.CASHFREE_ENV === "PRODUCTION";

    if (!clientId || !clientSecret) {
      return jsonError(
        "Cashfree credentials are not configured yet.",
        503
      );
    }

    const cashfreeBaseUrl = isProduction
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";

    // 4. Revalidate cart prices and stock on our own server.
    // Never accept a client-provided amount as authoritative.
    const validationUrl = new URL(
      "/api/checkout/validate",
      request.url
    );

    const validationResponse = await fetch(validationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: request.headers.get("authorization") || "",
      },
      body: JSON.stringify({ items }),
      cache: "no-store",
    });

    const validationResult = await validationResponse.json();

    if (
      !validationResponse.ok ||
      !validationResult.success ||
      validationResult.userId !== userId ||
      !Array.isArray(validationResult.items) ||
      validationResult.items.length === 0
    ) {
      return jsonError(
        validationResult.message ||
          "Unable to validate your cart.",
        validationResponse.status || 400
      );
    }

    const subtotal = Number(
      validationResult.totals?.subtotal
    );

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return jsonError("Invalid order amount.");
    }

    // 5. Apply the agreed prepaid cash discount.
    // Reward credit is NOT given here; it will be handled
    // after the order is delivered.
    const discount = subtotal >= 1000 ? 20 : 0;
    const shippingCharge = 0;
    const total = Math.round(
      (subtotal + shippingCharge - discount) * 100
    ) / 100;

    if (total <= 0) {
      return jsonError("Invalid final payment amount.");
    }

    // 6. Load the customer's saved contact details.
    const userSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .get();

    if (!userSnapshot.exists) {
      return jsonError("Customer account was not found.");
    }

    const userData = userSnapshot.data() || {};
    const email =
      typeof userData.email === "string"
        ? userData.email.trim()
        : "";

    // Cashfree order IDs must be unique.
    const cashfreeOrderId =
      `anjivo_${randomUUID().replace(/-/g, "")}`;

    const origin = new URL(request.url).origin;
    const returnUrl =
      `${origin}/checkout/payment-result?order_id={order_id}`;

    // 7. Create the payment order with Cashfree.
    const cashfreeResponse = await fetch(
      `${cashfreeBaseUrl}/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": CASHFREE_API_VERSION,
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
          "x-idempotency-key": randomUUID(),
        },
        body: JSON.stringify({
          order_id: cashfreeOrderId,
          order_amount: total,
          order_currency: "INR",
          customer_details: {
            customer_id: userId,
            customer_name: address.fullName.trim(),
            customer_phone: address.phone.trim(),
            ...(email ? { customer_email: email } : {}),
          },
          order_meta: {
            return_url: returnUrl,
          },
          order_note: "ANJIVO prepaid order",
        }),
        cache: "no-store",
      }
    );

    const cashfreeResult = await cashfreeResponse.json();

    if (
      !cashfreeResponse.ok ||
      typeof cashfreeResult.payment_session_id !== "string"
    ) {
      console.error(
        "Cashfree create order failed:",
        cashfreeResponse.status
      );

      return jsonError(
        "Unable to start payment. Please try again.",
        502
      );
    }

    // 8. Save a server-side payment intent.
    // The final order and stock deduction will happen only
    // after the payment has been verified.
    await adminDb
      .collection("paymentIntents")
      .doc(cashfreeOrderId)
      .create({
        id: cashfreeOrderId,
        provider: "CASHFREE",
        userId,
        providerOrderId: cashfreeOrderId,
        paymentSessionId: cashfreeResult.payment_session_id,
        paymentStatus: "PENDING",
        orderStatus: "PAYMENT_PENDING",
        shippingAddress: {
          fullName: address.fullName.trim(),
          phone: address.phone.trim(),
          addressLine1: address.addressLine1.trim(),
          ...(address.addressLine2?.trim()
            ? { addressLine2: address.addressLine2.trim() }
            : {}),
          city: address.city.trim(),
          state: address.state.trim(),
          pincode: address.pincode.trim(),
        },
        items: items.map((item: Record<string, unknown>) => ({
          productId: item.productId || item.id || "",
          sellerId: item.sellerId || "",
          quantity: item.quantity,
          pricingType: item.pricingType,
          wholesaleUnit: item.wholesaleUnit,
          piecesPerSet: item.piecesPerSet,
          setName: item.setName,
          setBreakAllowed: item.setBreakAllowed,
        })),
        subtotal,
        shippingCharge,
        discount,
        rewardCredit: subtotal >= 1000 ? 20 : 0,
        total,
        currency: "INR",
        cashfreeOrderStatus: cashfreeResult.order_status || "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return NextResponse.json({
      success: true,
      provider: "CASHFREE",
      orderId: cashfreeOrderId,
      paymentSessionId: cashfreeResult.payment_session_id,
      paymentMode: isProduction ? "PRODUCTION" : "SANDBOX",
      totals: {
        subtotal,
        shippingCharge,
        discount,
        total,
        pendingRewardCredit: subtotal >= 1000 ? 20 : 0,
      },
    });
  } catch (error) {
    console.error("Cashfree create-order error:", error);

    const message =
      error instanceof Error ? error.message : "";

    const isAuthError =
      /authentication|token|unauthorized/i.test(message);

    return jsonError(
      isAuthError
        ? "Please login again."
        : "Unable to create a payment session.",
      isAuthError ? 401 : 500
    );
  }
}
