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
  return NextResponse.json({ success: false, message }, { status });
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
    const fullName = stringValue(address.fullName);
    const phone = stringValue(address.phone);
    const addressLine1 = stringValue(address.addressLine1);
    const addressLine2 = stringValue(address.addressLine2);
    const city = stringValue(address.city);
    const state = stringValue(address.state);
    const pincode = stringValue(address.pincode);

    if (
      fullName.length < 2 ||
      !/^[6-9]\d{9}$/.test(phone) ||
      addressLine1.length < 5 ||
      city.length < 2 ||
      state.length < 2 ||
      !/^\d{6}$/.test(pincode)
    ) {
      return jsonError("Please enter a valid delivery address.");
    }

    const normalizedAddress: ShippingAddress = {
      fullName,
      phone,
      addressLine1,
      ...(addressLine2 ? { addressLine2 } : {}),
      city,
      state,
      pincode,
    };

    // 3. Require Cashfree credentials.
    const clientId = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    const isProduction = process.env.CASHFREE_ENV === "PRODUCTION";

    if (!clientId || !clientSecret) {
      return jsonError("Cashfree credentials are not configured yet.", 503);
    }

    const cashfreeBaseUrl = isProduction
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";

    // 4. Revalidate cart prices, selected variants and stock on our server.
    // Client-provided prices are never trusted.
    const validationUrl = new URL("/api/checkout/validate", request.url);
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
        validationResult.message || "Unable to validate your cart.",
        validationResponse.status || 400
      );
    }

    const validatedItems = validationResult.items as Array<Record<string, unknown>>;
    const subtotal = numberValue(validationResult.totals?.subtotal, NaN);
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return jsonError("Invalid order amount.");
    }

    // 5. Apply the agreed prepaid discount.
    const discount = subtotal >= 1000 ? 20 : 0;
    const shippingCharge = 0;
    const total = Math.round((subtotal + shippingCharge - discount) * 100) / 100;
    if (total <= 0) {
      return jsonError("Invalid final payment amount.");
    }

    // 6. Load customer's saved contact details.
    const userSnapshot = await adminDb.collection("users").doc(userId).get();
    if (!userSnapshot.exists) {
      return jsonError("Customer account was not found.");
    }
    const userData = userSnapshot.data() || {};
    const email = typeof userData.email === "string" ? userData.email.trim() : "";

    const cashfreeOrderId = `anjivo_${randomUUID().replace(/-/g, "")}`;
    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/checkout/payment-result?order_id={order_id}`;

    // 7. Create payment order with Cashfree.
    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
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
          customer_name: fullName,
          customer_phone: phone,
          ...(email ? { customer_email: email } : {}),
        },
        order_meta: { return_url: returnUrl },
        order_note: "ANJIVO prepaid order",
      }),
      cache: "no-store",
    });

    const cashfreeResult = await cashfreeResponse.json();
    if (
      !cashfreeResponse.ok ||
      typeof cashfreeResult.payment_session_id !== "string"
    ) {
      console.error("Cashfree create order failed:", cashfreeResponse.status);
      return jsonError("Unable to start payment. Please try again.", 502);
    }

    // 8. Store the server-validated item snapshot, including variant identity.
    // This snapshot is later compared during order creation after payment verification.
    const intentItems = validatedItems.map((item) => ({
      productId: stringValue(item.productId ?? item.id),
      sellerId: stringValue(item.sellerId),
      quantity: numberValue(item.quantity),
      pricingType: item.pricingType === "wholesale" ? "wholesale" : "retail",
      ...(item.wholesaleUnit === "SET" || item.wholesaleUnit === "PIECE"
        ? { wholesaleUnit: item.wholesaleUnit }
        : {}),
      ...(item.piecesPerSet !== undefined
        ? { piecesPerSet: numberValue(item.piecesPerSet) }
        : {}),
      ...(typeof item.setName === "string" && item.setName.trim()
        ? { setName: item.setName.trim() }
        : {}),
      ...(typeof item.setBreakAllowed === "boolean"
        ? { setBreakAllowed: item.setBreakAllowed }
        : {}),
      ...(typeof item.variantId === "string" && item.variantId.trim()
        ? { variantId: item.variantId.trim() }
        : {}),
      ...(typeof item.variantSku === "string" && item.variantSku.trim()
        ? { variantSku: item.variantSku.trim() }
        : {}),
      ...(typeof item.variantName === "string" && item.variantName.trim()
        ? { variantName: item.variantName.trim() }
        : {}),
      ...(typeof item.selectedSize === "string" && item.selectedSize.trim()
        ? { selectedSize: item.selectedSize.trim() }
        : {}),
      ...(typeof item.selectedColor === "string" && item.selectedColor.trim()
        ? { selectedColor: item.selectedColor.trim() }
        : {}),
      ...(typeof item.selectedVariantValue === "string" && item.selectedVariantValue.trim()
        ? { selectedVariantValue: item.selectedVariantValue.trim() }
        : {}),
    }));

    await adminDb.collection("paymentIntents").doc(cashfreeOrderId).create({
      id: cashfreeOrderId,
      provider: "CASHFREE",
      userId,
      providerOrderId: cashfreeOrderId,
      paymentSessionId: cashfreeResult.payment_session_id,
      paymentStatus: "PENDING",
      orderStatus: "PAYMENT_PENDING",
      shippingAddress: normalizedAddress,
      items: intentItems,
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
    const message = error instanceof Error ? error.message : "";
    const isAuthError = /authentication|token|unauthorized/i.test(message);
    return jsonError(
      isAuthError ? "Please login again." : "Unable to create a payment session.",
      isAuthError ? 401 : 500
    );
  }
}
