"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";
import {
  getCustomerById,
  updateCustomerStatus,
  type AdminCustomer,
} from "@/lib/admin-customers";

type CustomerOrder = {
  id: string;
  status?: string;
  totalAmount?: number;
  createdAt?: unknown;
};

type Address = {
  id: string;
  name?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  type?: string;
};

export default function AdminCustomerDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const customerId =
    typeof params.customerId === "string"
      ? params.customerId
      : "";

  const [customer, setCustomer] =
    useState<AdminCustomer | null>(null);

  const [orders, setOrders] =
    useState<CustomerOrder[]>([]);

  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              `/login?redirect=/admin/customers/${customerId}`
            );
            return;
          }

          try {
            setLoading(true);
            setError("");

            const userQuery =
              await getDocs(
                query(
                  collection(db, "users"),
                  where(
                    "uid",
                    "==",
                    user.uid
                  )
                )
              );

            if (
              userQuery.empty ||
              userQuery.docs[0].data()
                .role !== "ADMIN"
            ) {
              setError(
                "Admin access required."
              );
              setLoading(false);
              return;
            }

            if (!customerId) {
              setError(
                "Customer ID is missing."
              );
              setLoading(false);
              return;
            }

            const customerData =
              await getCustomerById(
                customerId
              );

            if (!customerData) {
              setError(
                "Customer not found."
              );
              setLoading(false);
              return;
            }

            setCustomer(customerData);

            await Promise.all([
              loadOrders(
                customerData.uid
              ),
              loadAddresses(
                customerData.uid
              ),
            ]);
          } catch (err) {
            console.error(
              "Customer details error:",
              err
            );

            setError(
              "Unable to load customer details."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router, customerId]);

  async function loadOrders(
    userId: string
  ) {
    try {
      const snapshot =
        await getDocs(
          query(
            collection(db, "orders"),
            where(
              "userId",
              "==",
              userId
            )
          )
        );

      const result: CustomerOrder[] =
        snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            status:
              typeof data.status ===
              "string"
                ? data.status
                : "pending",
            totalAmount:
              typeof data.totalAmount ===
              "number"
                ? data.totalAmount
                : 0,
            createdAt:
              data.createdAt,
          };
        });

      setOrders(result);
    } catch (err) {
      console.error(
        "Orders loading error:",
        err
      );

      setOrders([]);
    }
  }

  async function loadAddresses(
    userId: string
  ) {
    try {
      const snapshot =
        await getDocs(
          collection(
            db,
            "addresses",
            userId,
            "items"
          )
        );

      const result: Address[] =
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<
            Address,
            "id"
          >),
        }));

      setAddresses(result);
    } catch (err) {
      console.error(
        "Address loading error:",
        err
      );

      setAddresses([]);
    }
  }

  async function toggleStatus() {
    if (!customer) return;

    try {
      setActionLoading(true);
      setError("");

      const newStatus =
        customer.accountStatus ===
        "blocked"
          ? "active"
          : "blocked";

      await updateCustomerStatus(
        customer.id,
        newStatus
      );

      setCustomer({
        ...customer,
        accountStatus: newStatus,
      });
    } catch (err) {
      console.error(
        "Customer status error:",
        err
      );

      setError(
        "Unable to update customer status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading customer...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-black text-red-800">
              Customer Details
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error ||
                "Customer not found."}
            </p>

            <Link
              href="/admin/customers"
              className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              ← Back to Customers
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  const customerName =
    customer.name?.trim() ||
    "Unnamed Customer";

  const initials =
    customerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (word) =>
          word[0]?.toUpperCase()
      )
      .join("") || "C";

  const isBlocked =
    customer.accountStatus ===
    "blocked";

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* BACK */}

        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-2 text-xs font-black text-gray-500 hover:text-black"
        >
          ← Customers
        </Link>

        {/* HEADER */}

        <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black text-xl font-black text-white">
                {initials}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-2xl font-black">
                    {customerName}
                  </h1>

                  <span
                    className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
                      customer.role ===
                      "WHOLESALE_CUSTOMER"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {customer.role ===
                    "WHOLESALE_CUSTOMER"
                      ? "Wholesale"
                      : "Retail"}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
                      isBlocked
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {isBlocked
                      ? "Blocked"
                      : "Active"}
                  </span>

                </div>

                <p className="mt-1 text-sm text-gray-500">
                  {customer.email ||
                    "No email available"}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Customer ID:{" "}
                  {customer.id}
                </p>
              </div>

            </div>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={
                  toggleStatus
                }
                disabled={
                  actionLoading
                }
                className={`rounded-xl px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  isBlocked
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading
                  ? "Updating..."
                  : isBlocked
                  ? "Activate Customer"
                  : "Block Customer"}
              </button>

            </div>

          </div>

        </section>

        {/* SUMMARY */}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <SummaryCard
            title="Customer Type"
            value={
              customer.role ===
              "WHOLESALE_CUSTOMER"
                ? "Wholesale"
                : "Retail"
            }
            icon="👤"
          />

          <SummaryCard
            title="Orders"
            value={orders.length.toString()}
            icon="🛒"
          />

          <SummaryCard
            title="Addresses"
            value={addresses.length.toString()}
            icon="📍"
          />

          <SummaryCard
            title="Account"
            value={
              isBlocked
                ? "Blocked"
                : "Active"
            }
            icon={
              isBlocked
                ? "🔒"
                : "✓"
            }
          />

        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">

          {/* PROFILE */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 lg:col-span-2">

            <h2 className="text-lg font-black">
              Customer Profile
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Basic account information
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <InfoBox
                label="Full Name"
                value={
                  customer.name ||
                  "Not provided"
                }
              />

              <InfoBox
                label="Email"
                value={
                  customer.email ||
                  "Not provided"
                }
              />

              <InfoBox
                label="Phone"
                value={
                  customer.phone ||
                  "Not provided"
                }
              />

              <InfoBox
                label="Account Type"
                value={
                  customer.role ===
                  "WHOLESALE_CUSTOMER"
                    ? "Wholesale Customer"
                    : "Retail Customer"
                }
              />

              <InfoBox
                label="Account Status"
                value={
                  isBlocked
                    ? "Blocked"
                    : "Active"
                }
              />

              <InfoBox
                label="User UID"
                value={
                  customer.uid ||
                  "Not available"
                }
              />

            </div>

          </section>

          {/* ACCOUNT STATUS */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

            <h2 className="text-lg font-black">
              Account Control
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Manage customer access
            </p>

            <div className="mt-6 rounded-2xl bg-gray-50 p-5">

              <div className="text-3xl">
                {isBlocked
                  ? "🔒"
                  : "🟢"}
              </div>

              <h3 className="mt-4 text-sm font-black">
                {isBlocked
                  ? "Customer is blocked"
                  : "Customer is active"}
              </h3>

              <p className="mt-2 text-xs leading-5 text-gray-500">
                {isBlocked
                  ? "This customer account is currently marked as blocked."
                  : "This customer account is currently active."}
              </p>

              <button
                type="button"
                onClick={
                  toggleStatus
                }
                disabled={
                  actionLoading
                }
                className={`mt-5 w-full rounded-xl px-4 py-3 text-xs font-black text-white disabled:opacity-50 ${
                  isBlocked
                    ? "bg-green-600"
                    : "bg-red-600"
                }`}
              >
                {actionLoading
                  ? "Updating..."
                  : isBlocked
                  ? "Activate Account"
                  : "Block Account"}
              </button>

            </div>

          </section>

        </div>

        {/* ADDRESSES */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-black">
                Saved Addresses
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Customer delivery addresses
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black">
              {addresses.length}
            </span>

          </div>

          {addresses.length ===
          0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
              <div className="text-3xl">
                📍
              </div>

              <p className="mt-3 text-sm font-black">
                No saved addresses
              </p>

              <p className="mt-1 text-xs text-gray-500">
                This customer has not added
                any delivery address yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">

              {addresses.map(
                (address) => (
                  <div
                    key={address.id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between">

                      <p className="text-xs font-black">
                        {address.name ||
                          customerName}
                      </p>

                      {address.type && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-bold uppercase">
                          {address.type}
                        </span>
                      )}

                    </div>

                    {address.phone && (
                      <p className="mt-2 text-xs text-gray-500">
                        📞{" "}
                        {address.phone}
                      </p>
                    )}

                    <p className="mt-3 text-xs leading-5 text-gray-600">
                      {address.addressLine1 ||
                        ""}
                      {address.addressLine2
                        ? `, ${address.addressLine2}`
                        : ""}
                      {address.city
                        ? `, ${address.city}`
                        : ""}
                      {address.state
                        ? `, ${address.state}`
                        : ""}
                      {address.pincode
                        ? ` - ${address.pincode}`
                        : ""}
                    </p>
                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* ORDERS */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-black">
                Order History
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Orders placed by this customer
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black">
              {orders.length}
            </span>

          </div>

          {orders.length ===
          0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
              <div className="text-3xl">
                🛒
              </div>

              <p className="mt-3 text-sm font-black">
                No orders yet
              </p>

              <p className="mt-1 text-xs text-gray-500">
                This customer has not placed
                any orders.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">

              <table className="w-full min-w-[600px] text-left">

                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-3 font-black">
                      Order
                    </th>

                    <th className="px-3 py-3 font-black">
                      Status
                    </th>

                    <th className="px-3 py-3 font-black">
                      Amount
                    </th>

                    <th className="px-3 py-3 font-black">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map(
                    (order) => (
                      <tr
                        key={order.id}
                        className="border-b border-gray-50"
                      >
                        <td className="px-3 py-4 text-xs font-black">
                          #{order.id}
                        </td>

                        <td className="px-3 py-4">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-[9px] font-black uppercase">
                            {order.status ||
                              "Pending"}
                          </span>
                        </td>

                        <td className="px-3 py-4 text-xs font-black">
                          ₹
                          {(
                            order.totalAmount ||
                            0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        <td className="px-3 py-4">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-[10px] font-black underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* CUSTOMER IDENTITY */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

          <h2 className="text-lg font-black">
            System Information
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">

            <InfoBox
              label="Customer Document ID"
              value={customer.id}
            />

            <InfoBox
              label="Firebase UID"
              value={customer.uid}
            />

            <InfoBox
              label="Role"
              value={customer.role}
            />

            <InfoBox
              label="Account Status"
              value={
                customer.accountStatus ||
                "active"
              }
            />

          </div>

        </section>

      </main>

      <Footer />
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">

      <div className="flex items-center justify-between">
        <span className="text-xl">
          {icon}
        </span>

        <span className="text-[9px] font-black uppercase tracking-wide text-gray-400">
          Overview
        </span>
      </div>

      <p className="mt-5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
        {title}
      </p>

      <p className="mt-1 text-xl font-black">
        {value}
      </p>

    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">

      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-2 break-all text-xs font-bold text-gray-800">
        {value}
      </p>

    </div>
  );
}
