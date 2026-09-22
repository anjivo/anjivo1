import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type SellerOrderItem = {
  productId: string;
  name: string;
  quantity: number;
  selectedPrice: number;
  pricingType: "retail" | "wholesale";
  sellerId: string;
  sellerName?: string;
  image?: string;

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

export type SellerOrder = {
  id: string;
  userId: string;
  sellerId: string;

  items: SellerOrderItem[];

  shippingAddress?: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };

  paymentMethod?: "COD" | "ONLINE";
  paymentStatus?:
    | "pending"
    | "paid"
    | "failed"
    | "refunded";

  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;

  sellerSubtotal: number;

  status?:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "returned"
    | "refunded";

  fulfillmentStatus?:
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

  createdAt?: unknown;
  updatedAt?: unknown;
};

type RawCompositionItem = {
  variantType?: unknown;
  value?: unknown;
  quantity?: unknown;
  size?: unknown;
  color?: unknown;
};

function normalizeComposition(
  value: unknown
): SellerOrderItem["setComposition"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const result = value
    .map((raw): SellerOrderItem["setComposition"] extends Array<infer T> ? T | null : never => {
      const item = raw as RawCompositionItem;

      const variantType =
        item.variantType === "SIZE" ||
        item.variantType === "COLOR" ||
        item.variantType === "SIZE_COLOR" ||
        item.variantType === "CUSTOM"
          ? item.variantType
          : "CUSTOM";

      const compositionItem = {
        variantType,
        value:
          typeof item.value === "string"
            ? item.value
            : "",
        quantity:
          typeof item.quantity === "number" &&
          Number.isFinite(item.quantity)
            ? item.quantity
            : Number(item.quantity ?? 0),
        ...(typeof item.size === "string"
          ? { size: item.size }
          : {}),
        ...(typeof item.color === "string"
          ? { color: item.color }
          : {}),
      };

      if (
        !compositionItem.value ||
        !Number.isInteger(compositionItem.quantity) ||
        compositionItem.quantity <= 0
      ) {
        return null;
      }

      return compositionItem;
    })
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null
    );

  return result.length > 0 ? result : undefined;
}

function mapItem(rawItem: unknown): SellerOrderItem {
  const item =
    rawItem as Record<string, unknown>;

  const wholesaleUnit =
    item.wholesaleUnit === "SET" ||
    item.wholesaleUnit === "PIECE"
      ? item.wholesaleUnit
      : undefined;

  const piecesPerSet =
    Number(item.piecesPerSet ?? 0) > 0
      ? Number(item.piecesPerSet)
      : undefined;

  const setName =
    typeof item.setName === "string" &&
    item.setName.trim()
      ? item.setName.trim()
      : undefined;

  const setBreakAllowed =
    typeof item.setBreakAllowed === "boolean"
      ? item.setBreakAllowed
      : undefined;

  const setComposition =
    normalizeComposition(item.setComposition);

  const isSet =
    item.isSet === true ||
    wholesaleUnit === "SET";

  return {
    productId: String(item.productId ?? ""),
    name: String(item.name ?? ""),
    quantity: Number(item.quantity ?? 0),
    selectedPrice: Number(
      item.selectedPrice ??
        item.unitPrice ??
        0
    ),
    pricingType:
      item.pricingType === "wholesale"
        ? "wholesale"
        : "retail",
    sellerId: String(item.sellerId ?? ""),
    sellerName:
      item.sellerName !== undefined
        ? String(item.sellerName)
        : undefined,
    image:
      item.image !== undefined
        ? String(item.image)
        : undefined,

    wholesaleUnit,
    piecesPerSet,
    setName,
    setBreakAllowed,
    setComposition,
    isSet,
  };
}

function numberValue(
  value: unknown,
  fallback = 0
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function normalizeStatus(
  value: unknown
): SellerOrder["status"] {
  const allowed = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
    "refunded",
  ] as const;

  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as SellerOrder["status"])
    : "pending";
}

function normalizeFulfillmentStatus(
  value: unknown
): SellerOrder["fulfillmentStatus"] {
  const allowed = [
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
  ] as const;

  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as SellerOrder["fulfillmentStatus"])
    : "pending";
}

export async function getSellerOrders(
  sellerId: string
): Promise<SellerOrder[]> {
  const cleanSellerId = sellerId.trim();

  if (!cleanSellerId) {
    throw new Error("Seller ID is required.");
  }

  /*
   * SECURITY:
   * The query is restricted to orders whose sellerIds
   * contains the authenticated seller ID.
   *
   * The individual order items are then filtered again
   * by sellerId before they are returned to the UI.
   *
   * Firestore rules MUST independently enforce the same
   * seller ownership constraint. This client-side filter
   * is not a security boundary.
   */
  const ordersQuery = query(
    collection(db, "orders"),
    where(
      "sellerIds",
      "array-contains",
      cleanSellerId
    )
  );

  const snapshot =
    await getDocs(ordersQuery);

  const result: SellerOrder[] = [];

  snapshot.docs.forEach((orderDoc) => {
    const data =
      orderDoc.data();

    const rawItems =
      Array.isArray(data.items)
        ? data.items
        : [];

    const sellerItems =
      rawItems
        .map(mapItem)
        .filter(
          (item) =>
            item.sellerId ===
            cleanSellerId
        );

    if (sellerItems.length === 0) {
      return;
    }

    const sellerSubtotal =
      sellerItems.reduce(
        (total, item) =>
          total +
          numberValue(
            item.selectedPrice
          ) *
            numberValue(
              item.quantity
            ),
        0
      );

    const rawAddress =
      data.shippingAddress;

    const address =
      typeof rawAddress === "object" &&
      rawAddress !== null
        ? rawAddress
        : {};

    result.push({
      id: orderDoc.id,

      userId: stringValue(
        data.userId
      ),

      sellerId: cleanSellerId,

      items: sellerItems,

      shippingAddress:
        address as SellerOrder["shippingAddress"],

      paymentMethod:
        data.paymentMethod === "ONLINE"
          ? "ONLINE"
          : "COD",

      paymentStatus:
        data.paymentStatus === "paid" ||
        data.paymentStatus === "failed" ||
        data.paymentStatus === "refunded"
          ? data.paymentStatus
          : "pending",

      subtotal: numberValue(
        data.subtotal
      ),

      shippingCharge: numberValue(
        data.shippingCharge
      ),

      discount: numberValue(
        data.discount
      ),

      totalAmount: numberValue(
        data.totalAmount
      ),

      sellerSubtotal,

      status: normalizeStatus(
        data.orderStatus ??
          data.status
      ),

      fulfillmentStatus:
        normalizeFulfillmentStatus(
          data.fulfillmentStatus
        ),

      createdAt:
        data.createdAt,

      updatedAt:
        data.updatedAt,
    });
  });

  return result;
}

export function getSellerOrderStats(
  orders: SellerOrder[]
) {
  return {
    total: orders.length,

    pending: orders.filter(
      (order) =>
        order.fulfillmentStatus === "pending" ||
        order.status === "pending"
    ).length,

    confirmed: orders.filter(
      (order) =>
        order.fulfillmentStatus === "confirmed" ||
        order.status === "confirmed"
    ).length,

    processing: orders.filter(
      (order) =>
        order.fulfillmentStatus === "processing" ||
        order.status === "processing"
    ).length,

    shipped: orders.filter(
      (order) =>
        order.fulfillmentStatus === "shipped" ||
        order.status === "shipped"
    ).length,

    delivered: orders.filter(
      (order) =>
        order.fulfillmentStatus === "delivered" ||
        order.status === "delivered"
    ).length,

    cancelled: orders.filter(
      (order) =>
        order.fulfillmentStatus === "cancelled" ||
        order.status === "cancelled"
    ).length,

    returned: orders.filter(
      (order) =>
        order.fulfillmentStatus === "returned" ||
        order.status === "returned"
    ).length,
  };
}
