import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { CartItem } from "@/lib/cart";

export type ShippingAddress = {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

export type CreateOrderInput = {
  userId: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: "COD" | "ONLINE";
};

export async function createOrder(
  input: CreateOrderInput
): Promise<string> {
  const orderRef = doc(collection(db, "orders"));

  const sellerIds = Array.from(
    new Set(
      input.items.map((item) => item.sellerId)
    )
  );

  const subtotal = input.items.reduce(
    (total, item) =>
      total +
      item.selectedPrice * item.quantity,
    0
  );

  const totalQuantity = input.items.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  await setDoc(orderRef, {
    orderId: orderRef.id,

    userId: input.userId,

    sellerIds,

    items: input.items,

    shippingAddress:
      input.shippingAddress,

    paymentMethod:
      input.paymentMethod,

    subtotal,

    shippingCharge: 0,

    discount: 0,

    totalAmount: subtotal,

    totalQuantity,

    status: "pending",

    paymentStatus:
      input.paymentMethod === "COD"
        ? "pending"
        : "pending",

    createdAt: serverTimestamp(),

    updatedAt: serverTimestamp(),
  });

  return orderRef.id;
}
