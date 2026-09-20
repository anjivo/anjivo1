"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type CustomerType =
  | "RETAIL_CUSTOMER"
  | "WHOLESALE_CUSTOMER";

type CustomerStatus =
  | "ACTIVE"
  | "PENDING_VERIFICATION"
  | "BLOCKED"
  | "SUSPENDED";

type Customer = {
  id: string;
  uid: string;

  name: string;
  email: string;
  phone: string;

  role: string;
  customerType: CustomerType;

  emailVerified: boolean;
  phoneVerified: boolean;

  accountStatus: CustomerStatus;

  city?: string;
  state?: string;
  pincode?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type CustomerFilter =
  | "all"
  | "retail"
  | "wholesale"
  | "active"
  | "pending"
  | "blocked";

/* =========================================================
   HELPERS
========================================================= */

function getTimestampValue(
  value: unknown
): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    return Number(
      (value as { seconds?: unknown }).seconds ?? 0
    );
  }

  if (value instanceof Date) {
    return Math.floor(
      value.getTime() / 1000
    );
  }

  return 0;
}

function stringValue(
  value: unknown
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value);
}

function booleanValue(
  value: unknown
): boolean {
  return value === true;
}

function mapCustomer(
  id: string,
  data: Record<string, unknown>
): Customer {
  const rawType =
    stringValue(
      data.customerType
    );

  const customerType: CustomerType =
    rawType ===
    "WHOLESALE_CUSTOMER"
      ? "WHOLESALE_CUSTOMER"
      : "RETAIL_CUSTOMER";

  const rawStatus =
    stringValue(
      data.accountStatus
    );

  let accountStatus: CustomerStatus =
    "PENDING_VERIFICATION";

  if (
    rawStatus === "ACTIVE" ||
    rawStatus === "BLOCKED" ||
    rawStatus === "SUSPENDED"
  ) {
    accountStatus =
      rawStatus as CustomerStatus;
  }

  return {
    id,

    uid:
      stringValue(
        data.uid
      ) || id,

    name:
      stringValue(
        data.name
      ),

    email:
      stringValue(
        data.email
      ),

    phone:
      stringValue(
        data.phone
      ),

    role:
      stringValue(
        data.role
      ),

    customerType,

    emailVerified:
      booleanValue(
        data.emailVerified
      ),

    phoneVerified:
      booleanValue(
        data.phoneVerified
      ),

    accountStatus,

    city:
      data.city
        ? stringValue(data.city)
        : undefined,

    state:
      data.state
        ? stringValue(data.state)
        : undefined,

    pincode:
      data.pincode
        ? stringValue(data.pincode)
        : undefined,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminCustomersPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [filter, setFilter] =
    useState<CustomerFilter>("all");

  const [search, setSearch] =
    useState("");

  const [processing, setProcessing] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =========================================================
     ADMIN AUTH
  ========================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/customers";
            return;
          }

          try {
            const userSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !userSnapshot.exists()
            ) {
              window.location.href =
                "/";
              return;
            }

            const userData =
              userSnapshot.data();

            if (
              userData.role !==
              "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await loadCustomers();
          } catch (err) {
            console.error(
              "Customer admin auth error:",
              err
            );

            setError(
              "Unable to verify admin access."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  /* =========================================================
     LOAD CUSTOMERS
  ========================================================= */

  async function loadCustomers() {
    try {
      setError("");

      /*
       * Deliberately no orderBy("createdAt").
       * Older user documents may not have createdAt.
       */

      const snapshot =
        await getDocs(
          collection(
            db,
            "users"
          )
        );

      const list: Customer[] = [];

      snapshot.docs.forEach(
        (item) => {
          const data =
            item.data();

          /*
           * Only marketplace customers.
           * ADMIN and SELLER accounts
           * are excluded.
           */

          if (
            data.role !==
              "RETAIL_CUSTOMER" &&
            data.role !==
              "WHOLESALE_CUSTOMER"
          ) {
            return;
          }

          list.push(
            mapCustomer(
              item.id,
              data
            )
          );
        }
      );

      list.sort(
        (a, b) =>
          getTimestampValue(
            b.createdAt
          ) -
          getTimestampValue(
            a.createdAt
          )
      );

      setCustomers(list);
    } catch (err) {
      console.error(
        "Load customers error:",
        err
      );

      setError(
        "Customers load nahi ho paaye."
      );
    }
  }

  /* =========================================================
     ACTIVATE CUSTOMER
  ========================================================= */

  async function activateCustomer(
    customer: Customer
  ) {
    const confirmed =
      window.confirm(
        `Activate "${customer.name || customer.email}"?`
      );

    if (!confirmed) return;

    try {
      setProcessing(
        customer.id
      );

      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "users",
          customer.uid
        ),
        {
          accountStatus:
            "ACTIVE",

          updatedAt:
            serverTimestamp(),
        }
      );

      setCustomers(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              customer.id
                ? {
                    ...item,
                    accountStatus:
                      "ACTIVE",
                  }
                : item
          )
      );

      setSuccess(
        `${customer.name || "Customer"} is now active.`
      );
    } catch (err) {
      console.error(
        "Activate customer error:",
        err
      );

      setError(
        "Customer activate nahi ho saka."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     BLOCK CUSTOMER
  ========================================================= */

  async function blockCustomer(
    customer: Customer
  ) {
    const confirmed =
      window.confirm(
        `Block "${customer.name || customer.email}"?\n\nThe customer will not be treated as an active marketplace account.`
      );

    if (!confirmed) return;

    try {
      setProcessing(
        customer.id
      );

      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "users",
          customer.uid
        ),
        {
          accountStatus:
            "BLOCKED",

          updatedAt:
            serverTimestamp(),
        }
      );

      setCustomers(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              customer.id
                ? {
                    ...item,
                    accountStatus:
                      "BLOCKED",
                  }
                : item
          )
      );

      setSuccess(
        `${customer.name || "Customer"} has been blocked.`
      );
    } catch (err) {
      console.error(
        "Block customer error:",
        err
      );

      setError(
        "Customer block nahi ho saka."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     SUSPEND CUSTOMER
  ========================================================= */

  async function suspendCustomer(
    customer: Customer
  ) {
    const confirmed =
      window.confirm(
        `Suspend "${customer.name || customer.email}"?`
      );

    if (!confirmed) return;

    try {
      setProcessing(
        customer.id
      );

      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "users",
          customer.uid
        ),
        {
          accountStatus:
            "SUSPENDED",

          updatedAt:
            serverTimestamp(),
        }
      );

      setCustomers(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              customer.id
                ? {
                    ...item,
                    accountStatus:
                      "SUSPENDED",
                  }
                : item
          )
      );

      setSuccess(
        `${customer.name || "Customer"} has been suspended.`
      );
    } catch (err) {
      console.error(
        "Suspend customer error:",
        err
      );

      setError(
        "Customer suspend nahi ho saka."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredCustomers =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return customers.filter(
        (customer) => {
          let matchesFilter =
            true;

          if (
            filter === "retail"
          ) {
            matchesFilter =
              customer.customerType ===
              "RETAIL_CUSTOMER";
          }

          if (
            filter === "wholesale"
          ) {
            matchesFilter =
              customer.customerType ===
              "WHOLESALE_CUSTOMER";
          }

          if (
            filter === "active"
          ) {
            matchesFilter =
              customer.accountStatus ===
              "ACTIVE";
          }

          if (
            filter === "pending"
          ) {
            matchesFilter =
              customer.accountStatus ===
              "PENDING_VERIFICATION";
          }

          if (
            filter === "blocked"
          ) {
            matchesFilter =
              customer.accountStatus ===
              "BLOCKED";
          }

          const searchableText = [
            customer.name,
            customer.email,
            customer.phone,
            customer.city,
            customer.state,
            customer.pincode,
            customer.uid,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !searchText ||
            searchableText.includes(
              searchText
            );

          return (
            matchesFilter &&
            matchesSearch
          );
        }
      );
    }, [
      customers,
      filter,
      search,
    ]);

  /* =========================================================
     COUNTS
  ========================================================= */

  const counts =
    useMemo(() => {
      return {
        all:
          customers.length,

        retail:
          customers.filter(
            (customer) =>
              customer.customerType ===
              "RETAIL_CUSTOMER"
          ).length,

        wholesale:
          customers.filter(
            (customer) =>
              customer.customerType ===
              "WHOLESALE_CUSTOMER"
          ).length,

        active:
          customers.filter(
            (customer) =>
              customer.accountStatus ===
              "ACTIVE"
          ).length,

        pending:
          customers.filter(
            (customer) =>
              customer.accountStatus ===
              "PENDING_VERIFICATION"
          ).length,

        blocked:
          customers.filter(
            (customer) =>
              customer.accountStatus ===
              "BLOCKED"
          ).length,
      };
    }, [customers]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading Customer Management...
          </p>

        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#f5f6f8]">

      {/* HEADER */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">

          <Link href="/">
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex flex-wrap gap-2">

            <Link
              href="/admin"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Admin Dashboard
            </Link>

            <Link
              href="/admin/sellers"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Sellers
            </Link>

            <button
              type="button"
              onClick={() =>
                loadCustomers()
              }
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white"
            >
              ↻ Refresh
            </button>

          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">

        {/* TITLE */}

        <div>

          <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
            ADMIN / CUSTOMERS
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
            Customer Management
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Retail aur wholesale customers
            ko manage karein.
          </p>

        </div>

        {/* ALERTS */}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-700">
              ✓ {success}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* STATS */}

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

          <CustomerCount
            label="All"
            count={counts.all}
            active={
              filter === "all"
            }
            onClick={() =>
              setFilter("all")
            }
          />

          <CustomerCount
            label="Retail"
            count={counts.retail}
            active={
              filter === "retail"
            }
            onClick={() =>
              setFilter("retail")
            }
          />

          <CustomerCount
            label="Wholesale"
            count={
              counts.wholesale
            }
            active={
              filter ===
              "wholesale"
            }
            onClick={() =>
              setFilter(
                "wholesale"
              )
            }
          />

          <CustomerCount
            label="Active"
            count={counts.active}
            active={
              filter === "active"
            }
            onClick={() =>
              setFilter("active")
            }
          />

          <CustomerCount
            label="Pending"
            count={counts.pending}
            active={
              filter === "pending"
            }
            onClick={() =>
              setFilter("pending")
            }
          />

          <CustomerCount
            label="Blocked"
            count={counts.blocked}
            active={
              filter === "blocked"
            }
            onClick={() =>
              setFilter("blocked")
            }
          />

        </div>

        {/* SEARCH */}

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-3">

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search name, email, mobile, city, pincode or customer ID..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
          />

        </div>

        {/* LIST */}

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">

          {filteredCustomers.length ===
          0 ? (
            <div className="p-14 text-center">

              <div className="text-5xl">
                👤
              </div>

              <h2 className="mt-4 text-lg font-black">
                No customers found
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Search ya filter change
                karke try karein.
              </p>

            </div>
          ) : (
            <div className="divide-y divide-gray-100">

              {filteredCustomers.map(
                (customer) => (
                  <CustomerRow
                    key={
                      customer.id
                    }
                    customer={
                      customer
                    }
                    processing={
                      processing ===
                      customer.id
                    }
                    onActivate={() =>
                      activateCustomer(
                        customer
                      )
                    }
                    onBlock={() =>
                      blockCustomer(
                        customer
                      )
                    }
                    onSuspend={() =>
                      suspendCustomer(
                        customer
                      )
                    }
                  />
                )
              )}

            </div>
          )}

        </div>

      </div>
    </main>
  );
}

/* =========================================================
   COUNT
========================================================= */

function CustomerCount({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-black bg-black text-white"
          : "border-gray-200 bg-white hover:border-gray-400"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black">
        {count.toLocaleString(
          "en-IN"
        )}
      </p>
    </button>
  );
}

/* =========================================================
   CUSTOMER ROW
========================================================= */

function CustomerRow({
  customer,
  processing,
  onActivate,
  onBlock,
  onSuspend,
}: {
  customer: Customer;
  processing: boolean;
  onActivate: () => void;
  onBlock: () => void;
  onSuspend: () => void;
}) {
  const verificationCount =
    [
      customer.emailVerified,
      customer.phoneVerified,
    ].filter(Boolean).length;

  return (
    <div className="p-5 sm:p-6">

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

        {/* CUSTOMER */}

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <h2 className="text-lg font-black text-gray-900">
              {customer.name ||
                "Unnamed Customer"}
            </h2>

            <CustomerTypeBadge
              type={
                customer.customerType
              }
            />

            <StatusBadge
              status={
                customer.accountStatus
              }
            />

          </div>

          <div className="mt-3 flex flex-wrap gap-2">

            <InfoBadge>
              📧{" "}
              {customer.email ||
                "No email"}
            </InfoBadge>

            <InfoBadge>
              📱{" "}
              {customer.phone ||
                "No mobile"}
            </InfoBadge>

            {customer.city && (
              <InfoBadge>
                📍{" "}
                {customer.city}
                {customer.state
                  ? `, ${customer.state}`
                  : ""}
              </InfoBadge>
            )}

          </div>

          {/* VERIFICATION */}

          <div className="mt-5">

            <div className="flex items-center justify-between">

              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Verification
              </p>

              <p className="text-[10px] font-bold text-gray-500">
                {verificationCount}/2
                verified
              </p>

            </div>

            <div className="mt-2 flex flex-wrap gap-2">

              <VerificationBadge
                label="Email"
                verified={
                  customer.emailVerified
                }
              />

              <VerificationBadge
                label="Mobile"
                verified={
                  customer.phoneVerified
                }
              />

            </div>

          </div>

          {/* DETAILS */}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <DetailBox
              label="Customer Type"
              value={
                customer.customerType ===
                "WHOLESALE_CUSTOMER"
                  ? "Wholesale"
                  : "Retail"
              }
            />

            <DetailBox
              label="City"
              value={
                customer.city ||
                "Not provided"
              }
            />

            <DetailBox
              label="State"
              value={
                customer.state ||
                "Not provided"
              }
            />

            <DetailBox
              label="Pincode"
              value={
                customer.pincode ||
                "Not provided"
              }
            />

          </div>

          <p className="mt-4 break-all text-[9px] text-gray-400">
            Customer ID:{" "}
            {customer.uid}
          </p>

        </div>

        {/* ACTIONS */}

        <div className="flex shrink-0 flex-col gap-2 xl:w-44">

          {customer.accountStatus !==
            "ACTIVE" && (
            <button
              type="button"
              disabled={processing}
              onClick={
                onActivate
              }
              className="rounded-xl bg-green-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
            >
              {processing
                ? "Processing..."
                : "✓ Activate"}
            </button>
          )}

          {customer.accountStatus !==
            "BLOCKED" && (
            <button
              type="button"
              disabled={processing}
              onClick={
                onBlock
              }
              className="rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
            >
              {processing
                ? "Processing..."
                : "Block Customer"}
            </button>
          )}

          {customer.accountStatus !==
            "SUSPENDED" &&
            customer.accountStatus !==
              "BLOCKED" && (
              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onSuspend
                }
                className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs font-black text-orange-700 disabled:opacity-50"
              >
                Suspend
              </button>
            )}

        </div>

      </div>
    </div>
  );
}

/* =========================================================
   TYPE BADGE
========================================================= */

function CustomerTypeBadge({
  type,
}: {
  type: CustomerType;
}) {
  const wholesale =
    type ===
    "WHOLESALE_CUSTOMER";

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${
        wholesale
          ? "bg-purple-100 text-purple-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {wholesale
        ? "WHOLESALE"
        : "RETAIL"}
    </span>
  );
}

/* =========================================================
   STATUS
========================================================= */

function StatusBadge({
  status,
}: {
  status: CustomerStatus;
}) {
  const styles: Record<
    CustomerStatus,
    string
  > = {
    ACTIVE:
      "bg-green-100 text-green-700",

    PENDING_VERIFICATION:
      "bg-yellow-100 text-yellow-700",

    BLOCKED:
      "bg-red-100 text-red-700",

    SUSPENDED:
      "bg-orange-100 text-orange-700",
  };

  const labels: Record<
    CustomerStatus,
    string
  > = {
    ACTIVE: "ACTIVE",

    PENDING_VERIFICATION:
      "PENDING",

    BLOCKED: "BLOCKED",

    SUSPENDED: "SUSPENDED",
  };

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

/* =========================================================
   VERIFICATION
========================================================= */

function VerificationBadge({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${
        verified
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {verified
        ? "✓"
        : "○"}{" "}
      {label}
    </span>
  );
}

/* =========================================================
   INFO
========================================================= */

function InfoBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[10px] font-bold text-gray-600">
      {children}
    </span>
  );
}

/* =========================================================
   DETAIL
========================================================= */

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">

      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 break-all text-xs font-bold text-gray-700">
        {value}
      </p>

    </div>
  );
}
