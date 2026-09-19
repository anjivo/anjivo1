import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { CartItem } from "@/lib/cart";

export type ShippingAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type Order = {
  orderId: string;
  userId: string;
  sellerIds: string[];

  items: CartItem[];

  shippingAddress: ShippingAddress;

  paymentMethod: "COD" | "ONLINE";

  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;
  totalQuantity: number;

  status: OrderStatus;
  paymentStatus: PaymentStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateOrderInput = {
  userId: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: "COD" | "ONLINE";
};

function mapOrder(
  id: string,
  data: Record<string, unknown>
): Order {
  return {
    orderId: String(data.orderId ?? id),

    userId: String(data.userId ?? ""),

    sellerIds: Array.isArray(data.sellerIds)
      ? data.sellerIds.map(String)
      : [],

    items: Array.isArray(data.items)
      ? (data.items as CartItem[])
      : [],

    shippingAddress:
      data.shippingAddress as ShippingAddress,

    paymentMethod:
      data.paymentMethod === "ONLINE"
        ? "ONLINE"
        : "COD",

    subtotal: Number(data.subtotal ?? 0),

    shippingCharge: Number(
      data.shippingCharge ?? 0
    ),

    discount: Number(
      data.discount ?? 0
    ),

    totalAmount: Number(
      data.totalAmount ?? 0
    ),

    totalQuantity: Number(
      data.totalQuantity ?? 0
    ),

    status:
      data.status === "confirmed" ||
      data.status === "processing" ||
      data.status === "shipped" ||
      data.status === "out_for_delivery" ||
      data.status === "delivered" ||
      data.status === "cancelled"
        ? data.status
        : "pending",

    paymentStatus:
      data.paymentStatus === "paid" ||
      data.paymentStatus === "failed" ||
      data.paymentStatus === "refunded"
        ? data.paymentStatus
        : "pending",

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function createOrder(
  input: CreateOrderInput
): Promise<string> {
  const orderRef = doc(
    collection(db, "orders")
  );

  const sellerIds = Array.from(
    new Set(
      input.items.map(
        (item) => item.sellerId
      )
    )
  );

  const subtotal = input.items.reduce(
    (total, item) =>
      total +
      item.selectedPrice *
        item.quantity,
    0
  );

  const totalQuantity =
    input.items.reduce(
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

    paymentStatus: "pending",

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  });

  return orderRef.id;
}

export async function getUserOrders(
  userId: string
): Promise<Order[]> {
  const ordersQuery = query(
    collection(db, "orders"),
    where(
      "userId",
      "==",
      userId
    ),
    orderBy(
      "createdAt",
      "desc"
    )
  );

  const snapshot =
    await getDocs(ordersQuery);

  return snapshot.docs.map(
    (document) =>
      mapOrder(
        document.id,
        document.data()
      )
  );
}

export async function getOrderById(
  orderId: string
): Promise<Order | null> {
  const orderRef = doc(
    db,
    "orders",
    orderId
  );

  const snapshot =
    await getDoc(orderRef);

  if (!snapshot.exists()) {
    return null;
  }

  return mapOrder(
    snapshot.id,
    snapshot.data()
  );
}
