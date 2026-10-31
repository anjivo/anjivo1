import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";


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

  // Product variant snapshot captured when the order was placed.
  sku?: string;
  size?: string;
  color?: string;
  variant?: string;
  variantId?: string;
  variantType?: string;

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
   Seller Fulfillment / Shipment
---------------------------------------- */

export type SellerFulfillment = {
  status?: string;
  fulfillmentStatus?: string;
  courierName?: string;
  courier?: string;
  trackingNumber?: string;
  awbNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: unknown;
  shippedAt?: unknown;
  deliveredAt?: unknown;
  updatedAt?: unknown;
};

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

  // Live fulfillment / shipment data written by seller or admin workflows.
  fulfillmentStatus?: string;
  courierName?: string;
  courier?: string;
  trackingNumber?: string;
  awbNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: unknown;
  shippedAt?: unknown;
  deliveredAt?: unknown;

  // Per-seller shipment tracking for multi-seller orders.
  sellerFulfillment?: Record<string, SellerFulfillment>;

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
   Customer verification guard
---------------------------------------- */

/**
 * Client-side guard for customer order reads.
 * Firebase Auth is reloaded so verification fields are refreshed.
 * Server APIs and Firestore Rules must enforce verification and ownership too.
 */
async function requireVerifiedCustomer(userId: string): Promise<void> {
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid !== userId) {
    throw new Error("Please sign in to view your orders.");
  }

  // Refresh Firebase Auth state before checking the linked phone number.
  await currentUser.reload();

  const refreshedUser = auth.currentUser;

  if (!refreshedUser || refreshedUser.uid !== userId) {
    throw new Error("Your session has changed. Please sign in again.");
  }

  // ANJIVO registration uses phone OTP. Email verification is not required
  // to view orders because the email field is optional/not the verification flow.
  if (!refreshedUser.phoneNumber) {
    throw new Error("Please verify your mobile number first.");
  }
}

/* ----------------------------------------
   Normalize Firestore / API status values
---------------------------------------- */

function normalizeOrderStatus(value: unknown): OrderStatus {
  const raw = String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");

  const aliases: Record<string, OrderStatus> = {
    placed: "pending",
    order_placed: "pending",
    accepted: "confirmed",
    approved: "confirmed",
    ready_to_ship: "packed",
    dispatched: "shipped",
    in_transit: "shipped",
    on_the_way: "shipped",
    outfordelivery: "out_for_delivery",
    complete: "delivered",
    completed: "delivered",
  };

  if (aliases[raw]) return aliases[raw];

  const allowed: OrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "returned",
    "refunded",
  ];

  return allowed.includes(raw as OrderStatus)
    ? (raw as OrderStatus)
    : "pending";
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
                item.productId || item.id || "",

              sellerId:
                item.sellerId || "",

              sellerName:
                item.sellerName || "",

              name:
                clean(item.name) ||
                clean(item.productName) ||
                "Product",

              slug:
                clean(item.slug) ||
                clean(item.productSlug),

              image:
                clean(item.image),

              sku:
                clean(item.sku) ||
                clean(item.variantSku),

              size:
                clean(item.size) ||
                clean(item.selectedSize),

              color:
                clean(item.color) ||
                clean(item.selectedColor),

              variant:
                clean(item.variant) ||
                clean(item.variantName) ||
                clean(item.selectedVariantValue),

              variantId:
                clean(item.variantId),

              variantType:
                clean(item.variantType),

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
                  item.selectedPrice ??
                  item.unitPrice ??
                  item.price ??
                  0
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
                  item.subtotal ??
                  (
                    Number(item.selectedPrice ?? item.unitPrice ?? item.price ?? 0) *
                    Number(item.quantity ?? 0)
                  )
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

    // Prefer fulfillmentStatus because seller/admin shipment actions update it.
    // Normalize server-side uppercase values to the OrderStatus union.
    status: normalizeOrderStatus(
      data.fulfillmentStatus ||
      data.orderStatus ||
      data.status ||
      "pending"
    ),

    fulfillmentStatus:
      data.fulfillmentStatus || "",

    courierName:
      data.courierName || "",

    courier:
      data.courier || "",

    trackingNumber:
      data.trackingNumber || "",

    awbNumber:
      data.awbNumber || "",

    trackingUrl:
      data.trackingUrl || "",

    estimatedDelivery:
      data.estimatedDelivery,

    shippedAt:
      data.shippedAt,

    deliveredAt:
      data.deliveredAt,

    sellerFulfillment:
      data.sellerFulfillment &&
      typeof data.sellerFulfillment === "object" &&
      !Array.isArray(data.sellerFulfillment)
        ? Object.fromEntries(
            Object.entries(data.sellerFulfillment).map(([sellerId, raw]: [string, any]) => [
              sellerId,
              {
                status: raw?.status || "",
                fulfillmentStatus: raw?.fulfillmentStatus || "",
                courierName: raw?.courierName || "",
                courier: raw?.courier || "",
                trackingNumber: raw?.trackingNumber || "",
                awbNumber: raw?.awbNumber || "",
                trackingUrl: raw?.trackingUrl || "",
                estimatedDelivery: raw?.estimatedDelivery,
                shippedAt: raw?.shippedAt,
                deliveredAt: raw?.deliveredAt,
                updatedAt: raw?.updatedAt,
              } satisfies SellerFulfillment,
            ])
          )
        : undefined,

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

  await requireVerifiedCustomer(userId);

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
   Subscribe to a Customer Order (Live)
---------------------------------------- */

export function subscribeToOrderById(
  orderId: string,
  userId: string,
  onOrder: (order: Order | null) => void,
  onError?: (error: Error) => void
): () => void {
  if (!orderId || !userId) {
    onOrder(null);
    return () => {};
  }

  let cancelled = false;
  let unsubscribeSnapshot: (() => void) | undefined;

  // Verify the signed-in customer before opening the live order listener.
  void requireVerifiedCustomer(userId)
    .then(() => {
      if (cancelled) return;

      const orderRef = doc(db, "orders", orderId);

      unsubscribeSnapshot = onSnapshot(
        orderRef,
        (orderSnap) => {
          if (!orderSnap.exists()) {
            onOrder(null);
            return;
          }

          const data = orderSnap.data();

          // Additional client-side ownership check. Firestore Rules must
          // enforce ownership independently.
          if (data.userId !== userId) {
            onOrder(null);
            return;
          }

          onOrder(mapOrder(orderSnap.id, data));
        },
        (error) => {
          onError?.(error);
        }
      );
    })
    .catch((error: unknown) => {
      if (cancelled) return;
      onOrder(null);
      onError?.(
        error instanceof Error
          ? error
          : new Error("Unable to verify your account before loading this order.")
      );
    });

  return () => {
    cancelled = true;
    unsubscribeSnapshot?.();
  };
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

  await requireVerifiedCustomer(userId);

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
   Subscribe to All Customer Orders (Live)
---------------------------------------- */

export function subscribeToUserOrders(
  userId: string,
  onOrders: (orders: Order[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onOrders([]);
    return () => {};
  }

  let cancelled = false;
  let unsubscribeSnapshot: (() => void) | undefined;

  // Verify the signed-in customer before opening the live orders listener.
  void requireVerifiedCustomer(userId)
    .then(() => {
      if (cancelled) return;

      const ordersRef = collection(db, "orders");
      const ordersQuery = query(
        ordersRef,
        where("userId", "==", userId)
      );

      unsubscribeSnapshot = onSnapshot(
        ordersQuery,
        (snapshot) => {
          if (cancelled) return;

          const orders = snapshot.docs.map((orderDoc) =>
            mapOrder(orderDoc.id, orderDoc.data())
          );

          // Keep the newest order at the top without requiring a composite index.
          orders.sort(
            (a, b) =>
              getTimestampValue(b.createdAt) -
              getTimestampValue(a.createdAt)
          );

          onOrders(orders);
        },
        (error) => {
          if (cancelled) return;
          onError?.(error);
        }
      );
    })
    .catch((error: unknown) => {
      if (cancelled) return;

      onOrders([]);
      onError?.(
        error instanceof Error
          ? error
          : new Error("Unable to verify your account before loading orders.")
      );
    });

  return () => {
    cancelled = true;
    unsubscribeSnapshot?.();
  };
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
