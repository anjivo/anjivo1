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
    | "returned";

  createdAt?: unknown;
};

function mapItem(
  rawItem: unknown
): SellerOrderItem {
  const item =
    rawItem as Record<
      string,
      unknown
    >;

  return {
    productId: String(
      item.productId ?? ""
    ),

    name: String(
      item.name ?? ""
    ),

    quantity: Number(
      item.quantity ?? 0
    ),

    selectedPrice: Number(
      item.selectedPrice ?? 0
    ),

    pricingType:
      item.pricingType ===
      "wholesale"
        ? "wholesale"
        : "retail",

    sellerId: String(
      item.sellerId ?? ""
    ),

    sellerName:
      item.sellerName !== undefined
        ? String(item.sellerName)
        : undefined,

    image:
      item.image !== undefined
        ? String(item.image)
        : undefined,
  };
}

export async function getSellerOrders(
  sellerId: string
): Promise<SellerOrder[]> {
  if (!sellerId) {
    throw new Error(
      "Seller ID is required."
    );
  }

  /*
   * We query orders using sellerIds.
   * Then filter the individual order
   * items so seller only receives
   * their own items.
   */
  const ordersQuery = query(
    collection(db, "orders"),
    where(
      "sellerIds",
      "array-contains",
      sellerId
    )
  );

  const snapshot =
    await getDocs(ordersQuery);

  const result: SellerOrder[] = [];

  snapshot.docs.forEach(
    (orderDoc) => {
      const data = orderDoc.data();

      const rawItems = Array.isArray(
        data.items
      )
        ? data.items
        : [];

      const sellerItems =
        rawItems
          .map(mapItem)
          .filter(
            (item) =>
              item.sellerId ===
              sellerId
          );

      if (
        sellerItems.length === 0
      ) {
        return;
      }

      const sellerSubtotal =
        sellerItems.reduce(
          (total, item) =>
            total +
            item.selectedPrice *
              item.quantity,
          0
        );

      const address =
        typeof data.shippingAddress ===
          "object" &&
        data.shippingAddress !== null
          ? data.shippingAddress
          : {};

      result.push({
        id: orderDoc.id,

        userId: String(
          data.userId ?? ""
        ),

        sellerId,

        items: sellerItems,

        shippingAddress:
          address as SellerOrder["shippingAddress"],

        paymentMethod:
          data.paymentMethod ===
          "ONLINE"
            ? "ONLINE"
            : "COD",

        paymentStatus:
          data.paymentStatus ===
            "paid" ||
          data.paymentStatus ===
            "failed" ||
          data.paymentStatus ===
            "refunded"
            ? data.paymentStatus
            : "pending",

        subtotal: Number(
          data.subtotal ?? 0
        ),

        shippingCharge: Number(
          data.shippingCharge ?? 0
        ),

        discount: Number(
          data.discount ?? 0
        ),

        totalAmount: Number(
          data.totalAmount ?? 0
        ),

        sellerSubtotal,

        status:
          typeof data.status ===
          "string"
            ? (data.status as SellerOrder["status"])
            : "pending",

        createdAt:
          data.createdAt,
      });
    }
  );

  return result;
}

export function getSellerOrderStats(
  orders: SellerOrder[]
) {
  return {
    total: orders.length,

    pending: orders.filter(
      (order) =>
        order.status === "pending"
    ).length,

    confirmed: orders.filter(
      (order) =>
        order.status === "confirmed"
    ).length,

    processing: orders.filter(
      (order) =>
        order.status === "processing"
    ).length,

    shipped: orders.filter(
      (order) =>
        order.status === "shipped"
    ).length,

    delivered: orders.filter(
      (order) =>
        order.status === "delivered"
    ).length,

    cancelled: orders.filter(
      (order) =>
        order.status === "cancelled"
    ).length,

    returned: orders.filter(
      (order) =>
        order.status === "returned"
    ).length,
  };
}
