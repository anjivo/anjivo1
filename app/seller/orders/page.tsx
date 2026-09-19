"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

import {
  getSellerOrders,
  getSellerOrderStats,
  type SellerOrder,
} from "@/lib/seller-orders";

type Filter =
  | "all"
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

const filters: Filter[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

export default function SellerOrdersPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [loadingOrders, setLoadingOrders] =
    useState(false);

  const [sellerId, setSellerId] =
    useState("");

  const [sellerName, setSellerName] =
    useState("");

  const [orders, setOrders] =
    useState<SellerOrder[]>([]);

  const [filter, setFilter] =
    useState<Filter>("all");

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [updatingOrder, setUpdatingOrder] =
    useState<string | null>(null);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/seller/orders"
            );
            return;
          }

          try {
            const userRef = doc(
              db,
              "users",
              user.uid
            );

            const userSnapshot =
              await getDoc(userRef);

            if (
              !userSnapshot.exists()
            ) {
              router.replace(
                "/login"
              );
              return;
            }

            const userData =
              userSnapshot.data();

            if (
              userData.role !==
              "SELLER"
            ) {
              router.replace(
                "/account"
              );
              return;
            }

            if (
              userData.sellerStatus !==
              "approved"
            ) {
              router.replace(
                "/seller/application"
              );
              return;
            }

            setSellerId(user.uid);

            setSellerName(
              typeof userData.name ===
                "string"
                ? userData.name
                : "Seller"
            );

            await loadOrders(
              user.uid
            );
          } catch (err) {
            console.error(
              "Seller order auth error:",
              err
            );

            setError(
              "Unable to load seller account."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  async function loadOrders(
    currentSellerId: string
  ) {
    try {
      setLoadingOrders(true);
      setError("");

      const data =
        await getSellerOrders(
          currentSellerId
        );

      /*
       * Newest first.
       * We avoid requiring a Firestore
       * orderBy index here.
       */
      data.sort((a, b) => {
        const aTime =
          getTimestampValue(
            a.createdAt
          );

        const bTime =
          getTimestampValue(
            b.createdAt
          );

        return bTime - aTime;
      });

      setOrders(data);
    } catch (err) {
      console.error(
        "Seller orders loading error:",
        err
      );

      setError(
        "Unable to load orders."
      );
    } finally {
      setLoadingOrders(false);
    }
  }

  async function updateOrderStatus(
    orderId: string,
    status: SellerOrder["status"]
  ) {
    if (!sellerId) return;

    try {
      setUpdatingOrder(orderId);
      setError("");

      /*
       * IMPORTANT:
       * The current Firestore rule only allows
       * ADMIN to update orders.
       *
       * So this action is intentionally
       * blocked at UI level until seller-order
       * update rules are enabled.
       */
      setError(
        "Seller order status updates will be enabled after the seller order security rules are added."
      );

      void status;
    } finally {
      setUpdatingOrder(null);
    }
  }

  const filteredOrders =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          if (
            filter !== "all" &&
            order.status !== filter
          ) {
            return false;
          }

          if (!searchText) {
            return true;
          }

          const searchable = [
            order.id,
            order.userId,
            ...order.items.map(
              (item) =>
                item.name
            ),
            ...order.items.map(
              (item) =>
                item.productId
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            searchText
          );
        }
      );
    }, [
      orders,
      filter,
      search,
    ]);

  const stats =
    getSellerOrderStats(
      orders
    );

  if (loading) {
    return (
      <PageShell>
        <main className="mx-auto max-w-7xl px-4 py-16">
          <Loading />
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* HEADER */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <Link
              href="/seller"
              className="text-xs font-black text-gray-400 hover:text-black"
            >
              ← Seller Dashboard
            </Link>

            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              SELLER PANEL
            </p>

            <h1 className="mt-2 text-3xl font-black">
              My Orders
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {sellerName
                ? `Orders containing products from ${sellerName}`
                : "Orders containing your products"}
            </p>
          </div>

          <button
            type="button"
            disabled={
              loadingOrders ||
              !sellerId
            }
            onClick={() =>
              loadOrders(sellerId)
            }
            className="rounded-xl bg-black px-5 py-3 text-xs font-black text-white disabled:opacity-50"
          >
            {loadingOrders
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>

        </div>

        {/* SECURITY NOTICE */}

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">

          <p className="text-xs font-black text-blue-800">
            Seller privacy
          </p>

          <p className="mt-1 text-[11px] leading-5 text-blue-700">
            You can see only the order
            items belonging to your seller
            account. Products from other
            sellers in the same customer
            order are not exposed here.
          </p>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">

            <p className="text-xs font-black text-yellow-800">
              {error}
            </p>

          </div>
        )}

        {/* STATS */}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="Total Orders"
            value={stats.total}
            icon="🛒"
          />

          <StatCard
            title="Pending"
            value={stats.pending}
            icon="⏳"
          />

          <StatCard
            title="Processing"
            value={
              stats.processing
            }
            icon="⚙️"
          />

          <StatCard
            title="Delivered"
            value={
              stats.delivered
            }
            icon="✅"
          />

        </div>

        {/* FILTER */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">

          <div className="flex flex-col gap-4 lg:flex-row">

            <div className="flex-1">

              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Search
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Order ID, product name or product ID..."
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-xs outline-none focus:border-black"
              />

            </div>

            <div className="lg:w-56">

              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Status
              </label>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target
                      .value as Filter
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold outline-none focus:border-black"
              >
                <option value="all">
                  All Orders
                </option>

                {filters.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {formatStatus(
                        status
                      )}
                    </option>
                  )
                )}
              </select>

            </div>

          </div>

        </section>

        {/* ORDERS */}

        <section className="mt-6">

          <div className="mb-3">
            <p className="text-xs font-bold text-gray-500">
              Showing{" "}
              <span className="font-black text-black">
                {
                  filteredOrders.length
                }
              </span>{" "}
              order(s)
            </p>
          </div>

          {filteredOrders.length ===
          0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">

              <div className="text-4xl">
                🛒
              </div>

              <h2 className="mt-4 text-lg font-black">
                No seller orders
              </h2>

              <p className="mt-2 text-xs text-gray-500">
                Orders containing your
                products will appear here.
              </p>

            </div>
          ) : (
            <div className="space-y-5">

              {filteredOrders.map(
                (order) => (
                  <SellerOrderCard
                    key={order.id}
                    order={order}
                    processing={
                      updatingOrder ===
                      order.id
                    }
                    onStatusChange={
                      updateOrderStatus
                    }
                  />
                )
              )}

            </div>
          )}

        </section>

      </main>
    </PageShell>
  );
}

/* =========================================================
   ORDER CARD
========================================================= */

function SellerOrderCard({
  order,
  processing,
  onStatusChange,
}: {
  order: SellerOrder;
  processing: boolean;
  onStatusChange: (
    orderId: string,
    status: SellerOrder["status"]
  ) => void;
}) {
  const address =
    order.shippingAddress;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

      {/* TOP */}

      <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 lg:flex-row lg:items-start lg:justify-between">

        <div>

          <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
            Order ID
          </p>

          <p className="mt-1 break-all font-mono text-sm font-black">
            #{order.id}
          </p>

          <p className="mt-2 text-[10px] text-gray-400">
            Customer UID:{" "}
            {order.userId ||
              "Not available"}
          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          <StatusBadge
            status={
              order.status ||
              "pending"
            }
          />

          <span className="rounded-full bg-gray-100 px-3 py-1 text-[9px] font-black uppercase">
            {order.paymentMethod ||
              "COD"}
          </span>

          <PaymentBadge
            status={
              order.paymentStatus ||
              "pending"
            }
          />

        </div>

      </div>

      {/* ITEMS */}

      <div className="py-5">

        <div className="mb-3 flex items-center justify-between">

          <h3 className="text-sm font-black">
            Your Products
          </h3>

          <span className="text-[10px] font-bold text-gray-400">
            {order.items.length}{" "}
            item(s)
          </span>

        </div>

        <div className="space-y-3">

          {order.items.map(
            (item, index) => {
              const lineTotal =
                item.selectedPrice *
                item.quantity;

              return (
                <div
                  key={`${item.productId}-${index}`}
                  className="flex gap-3 rounded-2xl bg-gray-50 p-3"
                >

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">

                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        📦
                      </span>
                    )}

                  </div>

                  <div className="min-w-0 flex-1">

                    <p className="text-xs font-black">
                      {item.name}
                    </p>

                    <p className="mt-1 text-[10px] text-gray-400">
                      Product ID:{" "}
                      {item.productId}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">

                      <span
                        className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${
                          item.pricingType ===
                          "wholesale"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {
                          item.pricingType
                        }
                      </span>

                      <span className="rounded-full bg-white px-2 py-1 text-[8px] font-black">
                        Qty{" "}
                        {item.quantity}
                      </span>

                    </div>

                  </div>

                  <div className="text-right">

                    <p className="text-xs font-black">
                      ₹
                      {lineTotal.toLocaleString(
                        "en-IN"
                      )}
                    </p>

                    <p className="mt-1 text-[9px] text-gray-400">
                      ₹
                      {item.selectedPrice.toLocaleString(
                        "en-IN"
                      )}{" "}
                      / unit
                    </p>

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>

      {/* CUSTOMER DELIVERY */}

      <div className="grid gap-5 border-y border-gray-100 py-5 md:grid-cols-2">

        <div>

          <h3 className="text-sm font-black">
            Delivery Address
          </h3>

          <div className="mt-3 text-xs leading-5 text-gray-600">

            <p className="font-bold text-gray-900">
              {address?.fullName ||
                "—"}
            </p>

            <p>
              {address?.phone ||
                "—"}
            </p>

            <p className="mt-2">
              {address?.addressLine1 ||
                ""}
              {address?.addressLine2
                ? `, ${address.addressLine2}`
                : ""}
            </p>

            <p>
              {address?.city ||
                ""}
              {address?.city &&
              address?.state
                ? ", "
                : ""}
              {address?.state ||
                ""}
              {address?.pincode
                ? ` - ${address.pincode}`
                : ""}
            </p>

          </div>

        </div>

        <div>

          <h3 className="text-sm font-black">
            Your Order Value
          </h3>

          <div className="mt-3 rounded-2xl bg-gray-50 p-4">

            <div className="flex items-center justify-between">

              <span className="text-xs text-gray-500">
                Your products
              </span>

              <span className="text-sm font-black">
                ₹
                {order.sellerSubtotal.toLocaleString(
                  "en-IN"
                )}
              </span>

            </div>

            <p className="mt-2 text-[9px] leading-4 text-gray-400">
              This is the gross value of
              your items in this order.
              Marketplace commission and
              payout calculations will be
              handled separately.
            </p>

          </div>

        </div>

      </div>

      {/* STATUS */}

      <div className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
            Order Status
          </label>

          <select
            value={
              order.status ||
              "pending"
            }
            disabled={processing}
            onChange={(event) =>
              onStatusChange(
                order.id,
                event.target
                  .value as SellerOrder["status"]
              )
            }
            className="mt-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold outline-none disabled:opacity-50"
          >
            {[
              "pending",
              "confirmed",
              "processing",
              "shipped",
              "delivered",
              "cancelled",
              "returned",
            ].map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(
                    status
                  )}
                </option>
              )
            )}
          </select>

        </div>

        <div className="text-left lg:text-right">

          <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
            Order Total
          </p>

          <p className="mt-1 text-xl font-black">
            ₹
            {order.totalAmount.toLocaleString(
              "en-IN"
            )}
          </p>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function PageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      {children}

      <Footer />
    </div>
  );
}

function Loading() {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
      <div className="text-4xl">
        ⏳
      </div>

      <p className="mt-4 text-sm font-bold text-gray-500">
        Loading seller orders...
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">

      <div className="flex items-center justify-between">

        <span className="text-2xl">
          {icon}
        </span>

        <span className="text-[9px] font-black uppercase tracking-wide text-gray-400">
          Orders
        </span>

      </div>

      <p className="mt-5 text-[10px] font-black uppercase tracking-wide text-gray-400">
        {title}
      </p>

      <p className="mt-1 text-2xl font-black">
        {value.toLocaleString(
          "en-IN"
        )}
      </p>

    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: SellerOrder["status"];
}) {
  const value =
    status || "pending";

  const styles: Record<
    string,
    string
  > = {
    pending:
      "bg-yellow-100 text-yellow-700",
    confirmed:
      "bg-blue-100 text-blue-700",
    processing:
      "bg-purple-100 text-purple-700",
    shipped:
      "bg-indigo-100 text-indigo-700",
    delivered:
      "bg-green-100 text-green-700",
    cancelled:
      "bg-red-100 text-red-700",
    returned:
      "bg-orange-100 text-orange-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
        styles[value] ||
        "bg-gray-100 text-gray-600"
      }`}
    >
      {formatStatus(value)}
    </span>
  );
}

function PaymentBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    pending:
      "bg-yellow-100 text-yellow-700",
    paid:
      "bg-green-100 text-green-700",
    failed:
      "bg-red-100 text-red-700",
    refunded:
      "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
        styles[status] ||
        "bg-gray-100 text-gray-600"
      }`}
    >
      Payment:{" "}
      {formatStatus(status)}
    </span>
  );
}

function formatStatus(
  status: string
) {
  return status
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function getTimestampValue(
  timestamp: unknown
): number {
  if (!timestamp) {
    return 0;
  }

  if (
    typeof timestamp ===
      "object" &&
    timestamp !== null &&
    "toMillis" in timestamp &&
    typeof (
      timestamp as {
        toMillis?: unknown;
      }
    ).toMillis === "function"
  ) {
    return (
      timestamp as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (
    timestamp instanceof Date
  ) {
    return timestamp.getTime();
  }

  return 0;
}
