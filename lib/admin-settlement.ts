import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type OrderItem = {
  productId?: string;
  name?: string;
  sellerId?: string;
  quantity?: number;
  selectedPrice?: number;
  price?: number;
  subtotal?: number;
};

export type SettlementPreview = {
  sellerId: string;
  sellerName: string;

  orderId: string;

  grossAmount: number;

  commissionRate: number;
  commissionAmount: number;

  shippingCharge: number;
  otherCharges: number;

  netAmount: number;

  itemCount: number;
};

function roundMoney(value: number) {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

/* =========================================================
   COMMISSION
========================================================= */

async function getCommissionRate(
  sellerId: string
): Promise<number> {
  const sellerCommissionRef = doc(
    db,
    "sellerCommissions",
    sellerId
  );

  const sellerCommission =
    await getDoc(
      sellerCommissionRef
    );

  if (sellerCommission.exists()) {
    const data =
      sellerCommission.data();

    const rate = Number(
      data.commissionRate ?? 0
    );

    if (
      Number.isFinite(rate) &&
      rate >= 0 &&
      rate <= 100
    ) {
      return rate;
    }
  }

  const defaultCommissionRef =
    doc(
      db,
      "settings",
      "commission"
    );

  const defaultCommission =
    await getDoc(
      defaultCommissionRef
    );

  if (!defaultCommission.exists()) {
    return 5;
  }

  const data =
    defaultCommission.data();

  const rate = Number(
    data.defaultCommissionRate ?? 5
  );

  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100
  ) {
    return 5;
  }

  return rate;
}

/* =========================================================
   GET ORDER
========================================================= */

async function getOrder(
  orderId: string
) {
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

  return {
    id: snapshot.id,
    data: snapshot.data(),
  };
}

/* =========================================================
   SELLER ITEMS
========================================================= */

function getSellerItems(
  items: unknown,
  sellerId: string
): OrderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(
    (item): item is OrderItem => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return false;
      }

      return (
        String(
          (
            item as {
              sellerId?: unknown;
            }
          ).sellerId ?? ""
        ) === sellerId
      );
    }
  );
}

/* =========================================================
   CALCULATE SELLER GROSS
========================================================= */

function calculateSellerGross(
  items: OrderItem[]
): number {
  return roundMoney(
    items.reduce(
      (sum, item) => {
        const quantity =
          Number(
            item.quantity ?? 0
          );

        const price =
          Number(
            item.selectedPrice ??
              item.price ??
              0
          );

        const subtotal =
          Number(
            item.subtotal ?? 0
          );

        /*
         * Prefer stored subtotal.
         * Otherwise calculate price × quantity.
         */

        const itemValue =
          subtotal > 0
            ? subtotal
            : price * quantity;

        return (
          sum +
          Math.max(
            0,
            itemValue
          )
        );
      },
      0
    )
  );
}

/* =========================================================
   PREVIEW SETTLEMENT
========================================================= */

export async function previewSellerSettlement(
  orderId: string,
  sellerId: string
): Promise<SettlementPreview> {
  if (!orderId) {
    throw new Error(
      "Order ID is required."
    );
  }

  if (!sellerId) {
    throw new Error(
      "Seller ID is required."
    );
  }

  const order =
    await getOrder(orderId);

  const data = order.data;

  /*
   * Settlement should only happen
   * after delivery/completion.
   */

  const status = String(
    data.status ?? ""
  ).toLowerCase();

  if (
    status !== "delivered"
  ) {
    throw new Error(
      "Settlement can only be generated for a delivered order."
    );
  }

  const sellerItems =
    getSellerItems(
      data.items,
      sellerId
    );

  if (
    sellerItems.length === 0
  ) {
    throw new Error(
      "No items belonging to this seller were found in the order."
    );
  }

  const grossAmount =
    calculateSellerGross(
      sellerItems
    );

  if (grossAmount <= 0) {
    throw new Error(
      "Seller gross amount must be greater than zero."
    );
  }

  const commissionRate =
    await getCommissionRate(
      sellerId
    );

  const commissionAmount =
    roundMoney(
      grossAmount *
        (commissionRate / 100)
    );

  /*
   * Shipping allocation:
   *
   * For the first version, seller
   * shipping allocation is zero.
   *
   * Later we can distribute actual
   * shipping between sellers based
   * on shipment/package rules.
   */

  const shippingCharge = 0;

  const otherCharges = 0;

  const netAmount =
    roundMoney(
      grossAmount -
        commissionAmount -
        shippingCharge -
        otherCharges
    );

  return {
    sellerId,

    sellerName:
      sellerItems[0].name ??
      "Seller",

    orderId,

    grossAmount,

    commissionRate,

    commissionAmount,

    shippingCharge,

    otherCharges,

    netAmount,

    itemCount:
      sellerItems.length,
  };
}

/* =========================================================
   CHECK EXISTING PAYOUT
========================================================= */

export async function findExistingPayout(
  orderId: string,
  sellerId: string
) {
  const payoutQuery =
    query(
      collection(
        db,
        "sellerPayouts"
      ),
      where(
        "orderId",
        "==",
        orderId
      ),
      where(
        "sellerId",
        "==",
        sellerId
      )
    );

  const snapshot =
    await getDocs(
      payoutQuery
    );

  if (snapshot.empty) {
    return null;
  }

  const payout =
    snapshot.docs[0];

  return {
    id: payout.id,
    data: payout.data(),
  };
}

/* =========================================================
   CREATE SELLER PAYOUT
========================================================= */

export async function createSellerSettlement(
  orderId: string,
  sellerId: string
): Promise<string> {
  const existing =
    await findExistingPayout(
      orderId,
      sellerId
    );

  if (existing) {
    throw new Error(
      "A payout already exists for this seller and order."
    );
  }

  const settlement =
    await previewSellerSettlement(
      orderId,
      sellerId
    );

  const payoutRef = doc(
    collection(
      db,
      "sellerPayouts"
    )
  );

  await setDoc(
    payoutRef,
    {
      sellerId:
        settlement.sellerId,

      orderId:
        settlement.orderId,

      grossAmount:
        settlement.grossAmount,

      commissionRate:
        settlement.commissionRate,

      commissionAmount:
        settlement.commissionAmount,

      shippingCharge:
        settlement.shippingCharge,

      otherCharges:
        settlement.otherCharges,

      netAmount:
        settlement.netAmount,

      status:
        "pending",

      createdAt:
        serverTimestamp(),

      paidAt: null,

      reference: "",

      notes: "",
    }
  );

  return payoutRef.id;
}
