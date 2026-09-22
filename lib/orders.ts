import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  getCart,
  getWholesalePrice,
} from "@/lib/cart";

/* ----------------------------------------
   Shipping Address
---------------------------------------- */

export type ShippingAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

/* ----------------------------------------
   Order Item
---------------------------------------- */

export type OrderItem = {
  productId: string;
  sellerId: string;
  sellerName?: string;

  name: string;
  slug: string;
  image?: string;

  quantity: number;

  mrp: number;
  selectedPrice: number;

  pricingType: "retail" | "wholesale";

  moq: number;

  subtotal: number;

  // Wholesale / set order metadata
  wholesaleUnit?: "PIECE" | "SET";
  piecesPerSet?: number;
  setName?: string;
  setBreakAllowed?: boolean;
  setComposition?: Array<{
    variantType: "SIZE" | "COLOR" | "SIZE_COLOR" | "CUSTOM";
    value: string;
    quantity: number;
    size?: string;
    color?: string;
  }>;
  isSet?: boolean;
};

/* ----------------------------------------
   Order Status
---------------------------------------- */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

/* ----------------------------------------
   Order
---------------------------------------- */

export type Order = {
  id: string;

  userId: string;

  customerName?: string;
  customerEmail?: string;

  sellerIds: string[];

  items: OrderItem[];

  shippingAddress: ShippingAddress;

  paymentMethod: string;
  paymentStatus: string;

  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;

  status: OrderStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/* ----------------------------------------
   Create Order Input
---------------------------------------- */

export type CreateOrderInput = {
  userId: string;

  shippingAddress: ShippingAddress;

  paymentMethod: "COD";
};

/* ----------------------------------------
   Created Order
---------------------------------------- */

export type CreatedOrder = {
  orderId: string;

  totalAmount: number;

  subtotal: number;

  shippingCharge: number;

  discount: number;
};

/* ----------------------------------------
   Helpers
---------------------------------------- */

function clean(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

/* ----------------------------------------
   Map Firestore Order
---------------------------------------- */

function mapOrder(
  id: string,
  data: any
): Order {
  return {
    id,

    userId:
      data.userId || "",

    customerName:
      data.customerName || "",

    customerEmail:
      data.customerEmail || "",

    sellerIds:
      Array.isArray(data.sellerIds)
        ? data.sellerIds
        : [],

    items:
      Array.isArray(data.items)
        ? data.items.map(
            (item: any) => ({
              productId:
                item.productId || "",

              sellerId:
                item.sellerId || "",

              sellerName:
                item.sellerName || "",

              name:
                item.name ||
                "Product",

              slug:
                item.slug || "",

              image:
                item.image || "",

              quantity:
                Number(
                  item.quantity || 0
                ),

              mrp:
                Number(
                  item.mrp || 0
                ),

              selectedPrice:
                Number(
                  item.selectedPrice || 0
                ),

              pricingType:
                item.pricingType ===
                "wholesale"
                  ? "wholesale"
                  : "retail",

              moq:
                Number(
                  item.moq || 1
                ),

              subtotal:
                Number(
                  item.subtotal || 0
                ),

              wholesaleUnit:
                item.wholesaleUnit === "SET" ||
                item.wholesaleUnit === "PIECE"
                  ? item.wholesaleUnit
                  : undefined,

              piecesPerSet:
                Number(item.piecesPerSet || 0) > 0
                  ? Number(item.piecesPerSet)
                  : undefined,

              setName:
                typeof item.setName === "string" &&
                item.setName.trim()
                  ? item.setName.trim()
                  : undefined,

              setBreakAllowed:
                typeof item.setBreakAllowed === "boolean"
                  ? item.setBreakAllowed
                  : undefined,

              setComposition:
                Array.isArray(item.setComposition)
                  ? item.setComposition
                  : undefined,

              isSet:
                item.isSet === true ||
                item.wholesaleUnit === "SET",
            })
          )
        : [],

    shippingAddress: {
      fullName:
        data.shippingAddress
          ?.fullName || "",

      phone:
        data.shippingAddress
          ?.phone || "",

      addressLine1:
        data.shippingAddress
          ?.addressLine1 || "",

      addressLine2:
        data.shippingAddress
          ?.addressLine2 || "",

      city:
        data.shippingAddress
          ?.city || "",

      state:
        data.shippingAddress
          ?.state || "",

      pincode:
        data.shippingAddress
          ?.pincode || "",
    },

    paymentMethod:
      data.paymentMethod ||
      "COD",

    paymentStatus:
      data.paymentStatus ||
      "pending",

    subtotal:
      Number(
        data.subtotal || 0
      ),

    shippingCharge:
      Number(
        data.shippingCharge || 0
      ),

    discount:
      Number(
        data.discount || 0
      ),

    totalAmount:
      Number(
        data.totalAmount || 0
      ),

    // Current server order API uses `orderStatus`.
    // Keep `status` as a backward-compatible fallback for older orders.
    status:
      data.orderStatus ||
      data.status ||
      "pending",

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* ----------------------------------------
   Get Single Customer Order
---------------------------------------- */

export async function getOrderById(
  orderId: string,
  userId: string
): Promise<Order | null> {
  if (!orderId || !userId) {
    return null;
  }

  const orderRef = doc(
    db,
    "orders",
    orderId
  );

  const orderSnap =
    await getDoc(orderRef);

  if (!orderSnap.exists()) {
    return null;
  }

  const data =
    orderSnap.data();

  /*
   * Security check:
   * Customer can only access
   * their own order.
   */

  if (
    data.userId !== userId
  ) {
    return null;
  }

  return mapOrder(
    orderSnap.id,
    data
  );
}

/* ----------------------------------------
   Get All Orders Of Customer
---------------------------------------- */

export async function getUserOrders(
  userId: string
): Promise<Order[]> {
  if (!userId) {
    return [];
  }

  const ordersRef =
    collection(
      db,
      "orders"
    );

  const ordersQuery =
    query(
      ordersRef,
      where(
        "userId",
        "==",
        userId
      )
    );

  const snapshot =
    await getDocs(
      ordersQuery
    );

  const orders =
    snapshot.docs.map(
      (orderDoc) =>
        mapOrder(
          orderDoc.id,
          orderDoc.data()
        )
    );

  /*
   * Sort newest first.
   *
   * We are sorting in JavaScript
   * so this function does not require
   * a composite Firestore index.
   */

  orders.sort(
    (a, b) => {
      const aTime =
        getTimestampValue(
          a.createdAt
        );

      const bTime =
        getTimestampValue(
          b.createdAt
        );

      return bTime - aTime;
    }
  );

  return orders;
}

/* ----------------------------------------
   Timestamp Helper
---------------------------------------- */

function getTimestampValue(
  value: unknown
): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis === "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const time =
      new Date(value).getTime();

    return Number.isNaN(time)
      ? 0
      : time;
  }

  return 0;
}

/* ----------------------------------------
   Address Validation
---------------------------------------- */

function isValidAddress(
  address: ShippingAddress
): boolean {
  return (
    clean(
      address.fullName
    ).length >= 2 &&

    clean(
      address.phone
    ).length >= 10 &&

    clean(
      address.addressLine1
    ).length >= 5 &&

    clean(
      address.city
    ).length >= 2 &&

    clean(
      address.state
    ).length >= 2 &&

    clean(
      address.pincode
    ).length === 6
  );
}

/* ----------------------------------------
   Create Customer Order
---------------------------------------- */

export async function createCustomerOrder(
  _input: CreateOrderInput
): Promise<CreatedOrder> {
  /*
   * Orders must now be created through:
   *
   *   POST /api/checkout/validate
   *   POST /api/orders/create
   *
   * The server derives the authenticated user from the Firebase ID token,
   * re-validates prices/stock/set rules, and creates the order atomically.
   *
   * This legacy client-side function is intentionally disabled so no
   * browser code can bypass the secure order-creation flow.
   */
  throw new Error(
    "Direct client-side order creation is disabled. Please use the checkout API."
  );
}
