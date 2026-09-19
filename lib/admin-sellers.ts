import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type SellerApplication = {
  id: string;
  userId: string;

  businessName: string;
  ownerName: string;
  phone: string;
  email: string;

  businessType: string;
  category: string;

  address: string;
  city: string;
  state: string;
  pincode: string;

  gstNumber?: string;
  panNumber?: string;

  bankAccountName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;

  status:
    | "pending"
    | "approved"
    | "rejected";

  rejectionReason?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

function mapSeller(
  id: string,
  data: Record<string, unknown>
): SellerApplication {
  return {
    id,

    userId: String(
      data.userId ?? ""
    ),

    businessName: String(
      data.businessName ?? ""
    ),

    ownerName: String(
      data.ownerName ?? ""
    ),

    phone: String(
      data.phone ?? ""
    ),

    email: String(
      data.email ?? ""
    ),

    businessType: String(
      data.businessType ?? ""
    ),

    category: String(
      data.category ?? ""
    ),

    address: String(
      data.address ?? ""
    ),

    city: String(
      data.city ?? ""
    ),

    state: String(
      data.state ?? ""
    ),

    pincode: String(
      data.pincode ?? ""
    ),

    gstNumber:
      data.gstNumber
        ? String(
            data.gstNumber
          )
        : undefined,

    panNumber:
      data.panNumber
        ? String(
            data.panNumber
          )
        : undefined,

    bankAccountName:
      data.bankAccountName
        ? String(
            data.bankAccountName
          )
        : undefined,

    bankAccountNumber:
      data.bankAccountNumber
        ? String(
            data.bankAccountNumber
          )
        : undefined,

    ifscCode:
      data.ifscCode
        ? String(
            data.ifscCode
          )
        : undefined,

    status:
      data.status === "approved"
        ? "approved"
        : data.status ===
          "rejected"
        ? "rejected"
        : "pending",

    rejectionReason:
      data.rejectionReason
        ? String(
            data.rejectionReason
          )
        : undefined,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export async function getPendingSellerApplications() {
  const sellersQuery =
    query(
      collection(
        db,
        "sellers"
      ),
      where(
        "status",
        "==",
        "pending"
      ),
      orderBy(
        "createdAt",
        "desc"
      )
    );

  const snapshot =
    await getDocs(
      sellersQuery
    );

  return snapshot.docs.map(
    (item) =>
      mapSeller(
        item.id,
        item.data()
      )
  );
}

export async function updateSellerStatus(
  sellerId: string,
  userId: string,
  status:
    | "approved"
    | "rejected",
  rejectionReason = ""
) {
  await updateDoc(
    doc(
      db,
      "sellers",
      sellerId
    ),
    {
      status,

      rejectionReason:
        status === "rejected"
          ? rejectionReason
          : "",

      updatedAt:
        serverTimestamp(),
    }
  );

  await updateDoc(
    doc(
      db,
      "users",
      userId
    ),
    {
      role:
        status === "approved"
          ? "SELLER"
          : "RETAIL_CUSTOMER",

      sellerStatus:
        status,

      updatedAt:
        serverTimestamp(),
    }
  );
}
