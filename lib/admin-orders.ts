import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type AdminOrder = {
  id: string;
  userId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  sellerIds?: string[];
  sellerNames?: string[];

  items?: unknown[];

  subtotal?: number;
  shippingAmount?: number;
  discountAmount?: number;
  totalAmount?: number;

  paymentMethod?: string;
  paymentStatus?: string;

  status?:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "returned"
    | "refunded";

  shippingAddress?: unknown;

  createdAt?: unknown;
  updatedAt?: unknown;
};

function mapOrder(
  id: string,
  data: Record<string, unknown>
): AdminOrder {
  return {
    id,

    userId:
      typeof data.userId === "string"
        ? data.userId
        : "",

    customerName:
      typeof data.customerName === "string"
        ? data.customerName
        : "",

    customerEmail:
      typeof data.customerEmail === "string"
        ? data.customerEmail
        : "",

    customerPhone:
      typeof data.customerPhone === "string"
        ? data.customerPhone
        : "",

    sellerIds: Array.isArray(data.sellerIds)
      ? (data.sellerIds as string[])
      : [],

    sellerNames: Array.isArray(
      data.sellerNames
    )
      ? (data.sellerNames as string[])
      : [],

    items: Array.isArray(data.items)
      ? data.items
      : [],

    subtotal:
      typeof data.subtotal === "number"
        ? data.subtotal
        : 0,

    shippingAmount:
      typeof data.shippingAmount ===
      "number"
        ? data.shippingAmount
        : 0,

    discountAmount:
      typeof data.discountAmount ===
      "number"
        ? data.discountAmount
        : 0,

    totalAmount:
      typeof data.totalAmount ===
      "number"
        ? data.totalAmount
        : 0,

    paymentMethod:
      typeof data.paymentMethod ===
      "string"
        ? data.paymentMethod
        : "",

    paymentStatus:
      typeof data.paymentStatus ===
      "string"
        ? data.paymentStatus
        : "",

    status:
      typeof data.status === "string"
        ? (data.status as AdminOrder["status"])
        : "pending",

    shippingAddress:
      data.shippingAddress,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export async function getAllOrders(): Promise<
  AdminOrder[]
> {
  const ordersRef = collection(
    db,
    "orders"
  );

  try {
    const snapshot = await getDocs(
      query(
        ordersRef,
        orderBy("createdAt", "desc")
      )
    );

    return snapshot.docs.map((item) =>
      mapOrder(
        item.id,
        item.data() as Record<
          string,
          unknown
        >
      )
    );
  } catch (error) {
    console.warn(
      "createdAt order query failed. Loading orders without ordering.",
      error
    );

    const snapshot =
      await getDocs(ordersRef);

    const orders = snapshot.docs.map(
      (item) =>
        mapOrder(
          item.id,
          item.data() as Record<
            string,
            unknown
          >
        )
    );

    return orders;
  }
}

export async function getAdminOrder(
  orderId: string
): Promise<AdminOrder | null> {
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
    snapshot.data() as Record<
      string,
      unknown
    >
  );
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: AdminOrder["status"]
): Promise<void> {
  const orderRef = doc(
    db,
    "orders",
    orderId
  );

  const snapshot =
    await getDoc(orderRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Order not found."
    );
  }

  await updateDoc(orderRef, {
    status,
    updatedAt: new Date(),
  });
}

export async function updateAdminPaymentStatus(
  orderId: string,
  paymentStatus: string
): Promise<void> {
  const orderRef = doc(
    db,
    "orders",
    orderId
  );

  const snapshot =
    await getDoc(orderRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Order not found."
    );
  }

  await updateDoc(orderRef, {
    paymentStatus,
    updatedAt: new Date(),
  });
}
