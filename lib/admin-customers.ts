import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type AdminCustomer = {
  id: string;
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  role:
    | "RETAIL_CUSTOMER"
    | "WHOLESALE_CUSTOMER";
  accountStatus?: "active" | "blocked";
  createdAt?: unknown;
  updatedAt?: unknown;
};

function mapCustomer(
  id: string,
  data: Record<string, unknown>
): AdminCustomer {
  const role =
    data.role === "WHOLESALE_CUSTOMER"
      ? "WHOLESALE_CUSTOMER"
      : "RETAIL_CUSTOMER";

  return {
    id,
    uid: String(data.uid ?? id),
    name: data.name
      ? String(data.name)
      : undefined,
    email: data.email
      ? String(data.email)
      : undefined,
    phone: data.phone
      ? String(data.phone)
      : undefined,
    role,
    accountStatus:
      data.accountStatus === "blocked"
        ? "blocked"
        : "active",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getAllCustomers(): Promise<
  AdminCustomer[]
> {
  const snapshot = await getDocs(
    collection(db, "users")
  );

  return snapshot.docs
    .map((item) =>
      mapCustomer(
        item.id,
        item.data()
      )
    )
    .filter(
      (customer) =>
        customer.role ===
          "RETAIL_CUSTOMER" ||
        customer.role ===
          "WHOLESALE_CUSTOMER"
    );
}

export async function getCustomerById(
  customerId: string
): Promise<AdminCustomer | null> {
  const customerRef = doc(
    db,
    "users",
    customerId
  );

  const snapshot = await getDoc(
    customerRef
  );

  if (!snapshot.exists()) {
    return null;
  }

  const customer = mapCustomer(
    snapshot.id,
    snapshot.data()
  );

  if (
    customer.role !==
      "RETAIL_CUSTOMER" &&
    customer.role !==
      "WHOLESALE_CUSTOMER"
  ) {
    return null;
  }

  return customer;
}

export async function updateCustomerStatus(
  customerId: string,
  status: "active" | "blocked"
): Promise<void> {
  const customerRef = doc(
    db,
    "users",
    customerId
  );

  const snapshot = await getDoc(
    customerRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Customer not found."
    );
  }

  await updateDoc(
    customerRef,
    {
      accountStatus: status,
      updatedAt:
        new Date(),
    }
  );
}
