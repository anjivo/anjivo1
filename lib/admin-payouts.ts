import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type CommissionSettings = {
  defaultCommissionRate: number;
  updatedAt?: unknown;
};

export type SellerCommission = {
  sellerId: string;
  commissionRate: number;
  updatedAt?: unknown;
};

export type AdminPayout = {
  id: string;
  sellerId: string;
  orderId?: string;

  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;

  shippingCharge: number;
  otherCharges: number;

  netAmount: number;

  status:
    | "pending"
    | "processing"
    | "paid"
    | "failed"
    | "cancelled";

  createdAt?: unknown;
  paidAt?: unknown;

  reference?: string;
  notes?: string;
};

/* =========================================================
   DEFAULT COMMISSION
========================================================= */

export async function getDefaultCommissionRate(): Promise<number> {
  const settingsRef = doc(
    db,
    "settings",
    "commission"
  );

  const snapshot = await getDoc(
    settingsRef
  );

  if (!snapshot.exists()) {
    return 5;
  }

  const data = snapshot.data();

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
   UPDATE DEFAULT COMMISSION
========================================================= */

export async function updateDefaultCommissionRate(
  rate: number
): Promise<void> {
  if (!Number.isFinite(rate)) {
    throw new Error(
      "Invalid commission rate."
    );
  }

  if (rate < 0 || rate > 100) {
    throw new Error(
      "Commission rate must be between 0% and 100%."
    );
  }

  await setDoc(
    doc(
      db,
      "settings",
      "commission"
    ),
    {
      defaultCommissionRate: rate,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* =========================================================
   GET SELLER COMMISSION
========================================================= */

export async function getSellerCommission(
  sellerId: string
): Promise<number> {
  if (!sellerId) {
    return getDefaultCommissionRate();
  }

  const sellerCommissionRef =
    doc(
      db,
      "sellerCommissions",
      sellerId
    );

  const snapshot = await getDoc(
    sellerCommissionRef
  );

  if (!snapshot.exists()) {
    return getDefaultCommissionRate();
  }

  const data = snapshot.data();

  const rate = Number(
    data.commissionRate
  );

  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100
  ) {
    return getDefaultCommissionRate();
  }

  return rate;
}

/* =========================================================
   UPDATE SELLER COMMISSION
========================================================= */

export async function updateSellerCommission(
  sellerId: string,
  rate: number
): Promise<void> {
  if (!sellerId) {
    throw new Error(
      "Seller ID is required."
    );
  }

  if (!Number.isFinite(rate)) {
    throw new Error(
      "Invalid commission rate."
    );
  }

  if (rate < 0 || rate > 100) {
    throw new Error(
      "Commission rate must be between 0% and 100%."
    );
  }

  await setDoc(
    doc(
      db,
      "sellerCommissions",
      sellerId
    ),
    {
      sellerId,
      commissionRate: rate,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* =========================================================
   GET ALL PAYOUTS
========================================================= */

export async function getAllPayouts(): Promise<
  AdminPayout[]
> {
  const snapshot = await getDocs(
    collection(
      db,
      "sellerPayouts"
    )
  );

  const payouts: AdminPayout[] =
    snapshot.docs.map(
      (payoutDoc) => {
        const data =
          payoutDoc.data();

        const status =
          data.status ===
            "processing" ||
          data.status === "paid" ||
          data.status === "failed" ||
          data.status === "cancelled"
            ? data.status
            : "pending";

        return {
          id: payoutDoc.id,

          sellerId: String(
            data.sellerId ?? ""
          ),

          orderId:
            typeof data.orderId ===
            "string"
              ? data.orderId
              : undefined,

          grossAmount: Number(
            data.grossAmount ?? 0
          ),

          commissionRate: Number(
            data.commissionRate ?? 0
          ),

          commissionAmount: Number(
            data.commissionAmount ?? 0
          ),

          shippingCharge: Number(
            data.shippingCharge ?? 0
          ),

          otherCharges: Number(
            data.otherCharges ?? 0
          ),

          netAmount: Number(
            data.netAmount ?? 0
          ),

          status,

          createdAt:
            data.createdAt,

          paidAt:
            data.paidAt,

          reference:
            typeof data.reference ===
            "string"
              ? data.reference
              : undefined,

          notes:
            typeof data.notes ===
            "string"
              ? data.notes
              : undefined,
        };
      }
    );

  return payouts.sort(
    (a, b) => {
      const aTime =
        a.createdAt &&
        typeof (
          a.createdAt as {
            seconds?: unknown;
          }
        ).seconds === "number"
          ? (
              a.createdAt as {
                seconds: number;
              }
            ).seconds
          : 0;

      const bTime =
        b.createdAt &&
        typeof (
          b.createdAt as {
            seconds?: unknown;
          }
        ).seconds === "number"
          ? (
              b.createdAt as {
                seconds: number;
              }
            ).seconds
          : 0;

      return bTime - aTime;
    }
  );
}

/* =========================================================
   UPDATE PAYOUT STATUS
========================================================= */

export async function updatePayoutStatus(
  payoutId: string,
  status: AdminPayout["status"],
  reference?: string,
  notes?: string
): Promise<void> {
  if (!payoutId) {
    throw new Error(
      "Payout ID is required."
    );
  }

  const allowedStatuses = [
    "pending",
    "processing",
    "paid",
    "failed",
    "cancelled",
  ];

  if (
    !allowedStatuses.includes(
      status
    )
  ) {
    throw new Error(
      "Invalid payout status."
    );
  }

  const payoutRef = doc(
    db,
    "sellerPayouts",
    payoutId
  );

  const updateData: Record<
    string,
    unknown
  > = {
    status,
    updatedAt:
      serverTimestamp(),
  };

  if (reference !== undefined) {
    updateData.reference =
      reference.trim();
  }

  if (notes !== undefined) {
    updateData.notes =
      notes.trim();
  }

  if (status === "paid") {
    updateData.paidAt =
      serverTimestamp();
  }

  await updateDoc(
    payoutRef,
    updateData
  );
}
