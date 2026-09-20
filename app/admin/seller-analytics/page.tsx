"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Seller = {
  id: string;
  userId: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  category: string;
  status: string;
  sellerVerified: boolean;
  adminApproved: boolean;
  accountStatus: string;
  createdAt?: unknown;
};

type Product = {
  id: string;
  sellerId: string;
  name: string;
  status: string;
  stock: number;
  retailPrice: number;
  wholesalePrice: number;
};

type OrderItem = {
  sellerId: string;
  sellerName: string;
  quantity: number;
  price: number;
  selectedPrice: number;
  total: number;
  pricingType: string;
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt?: unknown;
  items: OrderItem[];
};

type SellerAnalytics = Seller & {
  totalProducts: number;
  activeProducts: number;
  outOfStockProducts: number;
  blockedProducts: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  processingOrders: number;
  totalItemsSold: number;
  retailItemsSold: number;
  wholesaleItemsSold: number;
  retailSales: number;
  wholesaleSales: number;
  totalSales: number;
  averageOrderValue: number;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function timestampValue(
  value: unknown
): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
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

  if (typeof value === "string") {
    const time =
      new Date(value).getTime();

    return Number.isFinite(time)
      ? time
      : 0;
  }

  return 0;
}

function formatDate(
  value: unknown
): string {
  const millis =
    timestampValue(value);

  if (!millis) return "—";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
    }
  ).format(new Date(millis));
}

function formatCurrency(
  value: number
): string {
  return `₹${Math.round(
    value
  ).toLocaleString("en-IN")}`;
}

function mapSeller(
  id: string,
  data: Record<string, unknown>
): Seller {
  return {
    id,

    userId:
      stringValue(data.userId) ||
      id,

    businessName:
      stringValue(
        data.businessName
      ) ||
      "Unnamed Seller",

    ownerName:
      stringValue(
        data.ownerName
      ),

    phone:
      stringValue(data.phone),

    email:
      stringValue(data.email),

    city:
      stringValue(data.city),

    state:
      stringValue(data.state),

    category:
      stringValue(
        data.category
      ),

    status:
      stringValue(data.status) ||
      "pending",

    sellerVerified:
      booleanValue(
        data.sellerVerified
      ),

    adminApproved:
      booleanValue(
        data.adminApproved
      ),

    accountStatus:
      stringValue(
        data.accountStatus
      ) || "PENDING",

    createdAt:
      data.createdAt,
  };
}

function mapProduct(
  id: string,
  data: Record<string, unknown>
): Product {
  return {
    id,

    sellerId:
      stringValue(data.sellerId),

    name:
      stringValue(data.name) ||
      "Product",

    status:
      stringValue(data.status) ||
      "draft",

    stock:
      numberValue(data.stock),

    retailPrice:
      numberValue(
        data.retailPrice
      ),

    wholesalePrice:
      numberValue(
        data.wholesalePrice
      ),
  };
}

function mapOrder(
  id: string,
  data: Record<string, unknown>
): Order {
  const rawItems = Array.isArray(
    data.items
  )
    ? data.items
    : [];

  const items: OrderItem[] =
    rawItems.map((raw) => {
      const item =
        typeof raw === "object" &&
        raw !== null
          ? (raw as Record<
              string,
              unknown
            >)
          : {};

      const price =
        numberValue(
          item.selectedPrice
        ) ||
        numberValue(item.price);

      const quantity =
        numberValue(
          item.quantity
        );

      const total =
        numberValue(item.total) ||
        price * quantity;

      return {
        sellerId:
          stringValue(
            item.sellerId
          ),

        sellerName:
          stringValue(
            item.sellerName
          ),

        quantity,

        price,

        selectedPrice:
          numberValue(
            item.selectedPrice
          ),

        total,

        pricingType:
          stringValue(
            item.pricingType
          ) || "retail",
      };
    });

  return {
    id,

    status:
      stringValue(
        data.status
      ) || "pending",

    paymentStatus:
      stringValue(
        data.paymentStatus
      ) || "pending",

    total:
      numberValue(data.total) ||
      numberValue(
        data.grandTotal
      ),

    createdAt:
      data.createdAt,

    items,
  };
}

function calculateSellerAnalytics(
  seller: Seller,
  products: Product[],
  orders: Order[]
): SellerAnalytics {
  const sellerProducts =
    products.filter(
      (product) =>
        product.sellerId ===
        seller.id ||
        product.sellerId ===
        seller.userId
    );

  let totalOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  let returnedOrders = 0;
  let processingOrders = 0;

  let totalItemsSold = 0;
  let retailItemsSold = 0;
  let wholesaleItemsSold = 0;

  let retailSales = 0;
  let wholesaleSales = 0;

  orders.forEach((order) => {
    const sellerItems =
      order.items.filter(
        (item) =>
          item.sellerId ===
            seller.id ||
          item.sellerId ===
            seller.userId
      );

    if (
      sellerItems.length === 0
    ) {
      return;
    }

    totalOrders += 1;

    if (
      order.status ===
      "delivered"
    ) {
      deliveredOrders += 1;
    }

    if (
      order.status ===
      "cancelled"
    ) {
      cancelledOrders += 1;
    }

    if (
      order.status ===
      "returned"
    ) {
      returnedOrders += 1;
    }

    if (
      order.status ===
        "pending" ||
      order.status ===
        "confirmed" ||
      order.status ===
        "processing" ||
      order.status ===
        "shipped"
    ) {
      processingOrders += 1;
    }

    sellerItems.forEach(
      (item) => {
        totalItemsSold +=
          item.quantity;

        if (
          item.pricingType ===
          "wholesale"
        ) {
          wholesaleItemsSold +=
            item.quantity;

          wholesaleSales +=
            item.total;
        } else {
          retailItemsSold +=
            item.quantity;

          retailSales +=
            item.total;
        }
      }
    );
  });

  const totalSales =
    retailSales +
    wholesaleSales;

  const averageOrderValue =
    totalOrders > 0
      ? totalSales /
        totalOrders
      : 0;

  return {
    ...seller,

    totalProducts:
      sellerProducts.length,

    activeProducts:
      sellerProducts.filter(
        (product) =>
          product.status ===
          "active"
      ).length,

    outOfStockProducts:
      sellerProducts.filter(
        (product) =>
          product.status ===
            "out_of_stock" ||
          product.stock <= 0
      ).length,

    blockedProducts:
      sellerProducts.filter(
        (product) =>
          product.status ===
          "blocked"
      ).length,

    totalOrders,

    deliveredOrders,

    cancelledOrders,

    returnedOrders,

    processingOrders,

    totalItemsSold,

    retailItemsSold,

    wholesaleItemsSold,

    retailSales,

    wholesaleSales,

    totalSales,

    averageOrderValue,
  };
}

export default function SellerAnalyticsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [sellers, setSellers] =
    useState<SellerAnalytics[]>([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [performanceFilter, setPerformanceFilter] =
    useState("all");

  const [selectedSeller, setSelectedSeller] =
    useState<SellerAnalytics | null>(
      null
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/seller-analytics";
            return;
          }

          try {
            const adminSnap =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !adminSnap.exists() ||
              adminSnap.data().role !==
                "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await loadAnalytics();
          } catch (error) {
            console.error(
              "Seller analytics authorization error:",
              error
            );

            window.location.href =
              "/";
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, []);

  async function loadAnalytics() {
    try {
      const [
        sellerSnapshot,
        productSnapshot,
        orderSnapshot,
      ] = await Promise.all([
        getDocs(
          collection(
            db,
            "sellers"
          )
        ),

        getDocs(
          collection(
            db,
            "products"
          )
        ),

        getDocs(
          collection(
            db,
            "orders"
          )
        ),
      ]);

      const sellerList: Seller[] =
        sellerSnapshot.docs.map(
          (item) =>
            mapSeller(
              item.id,
              item.data()
            )
        );

      const productList: Product[] =
        productSnapshot.docs.map(
          (item) =>
            mapProduct(
              item.id,
              item.data()
            )
        );

      const orderList: Order[] =
        orderSnapshot.docs.map(
          (item) =>
            mapOrder(
              item.id,
              item.data()
            )
        );

      const analytics =
        sellerList.map(
          (seller) =>
            calculateSellerAnalytics(
              seller,
              productList,
              orderList
            )
        );

      analytics.sort(
        (a, b) =>
          b.totalSales -
          a.totalSales
      );

      setSellers(analytics);
    } catch (error) {
      console.error(
        "Load seller analytics error:",
        error
      );

      alert(
        "Seller analytics load nahi ho paaya. Firestore rules check karein."
      );
    }
  }

  const filteredSellers =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return sellers.filter(
        (seller) => {
          const searchMatch =
            !query ||
            seller.businessName
              .toLowerCase()
              .includes(query) ||
            seller.ownerName
              .toLowerCase()
              .includes(query) ||
            seller.email
              .toLowerCase()
              .includes(query) ||
            seller.phone
              .toLowerCase()
              .includes(query) ||
            seller.city
              .toLowerCase()
              .includes(query) ||
            seller.state
              .toLowerCase()
              .includes(query) ||
            seller.id
              .toLowerCase()
              .includes(query);

          const statusMatch =
            statusFilter ===
              "all" ||
            seller.status ===
              statusFilter;

          let performanceMatch =
            true;

          if (
            performanceFilter ===
            "sales"
          ) {
            performanceMatch =
              seller.totalSales >
              0;
          }

          if (
            performanceFilter ===
            "orders"
          ) {
            performanceMatch =
              seller.totalOrders >
              0;
          }

          if (
            performanceFilter ===
            "products"
          ) {
            performanceMatch =
              seller.totalProducts >
              0;
          }

          if (
            performanceFilter ===
            "no_sales"
          ) {
            performanceMatch =
              seller.totalSales ===
              0;
          }

          return (
            searchMatch &&
            statusMatch &&
            performanceMatch
          );
        }
      );
    }, [
      sellers,
      search,
      statusFilter,
      performanceFilter,
    ]);

  const stats = useMemo(() => {
    const totalSellers =
      sellers.length;

    const approved =
      sellers.filter(
        (seller) =>
          seller.status ===
          "approved"
      ).length;

    const pending =
      sellers.filter(
        (seller) =>
          seller.status ===
          "pending"
      ).length;

    const blocked =
      sellers.filter(
        (seller) =>
          seller.status ===
          "blocked"
      ).length;

    const totalProducts =
      sellers.reduce(
        (sum, seller) =>
          sum +
          seller.totalProducts,
        0
      );

    const totalSales =
      sellers.reduce(
        (sum, seller) =>
          sum +
          seller.totalSales,
        0
      );

    const totalOrders =
      sellers.reduce(
        (sum, seller) =>
          sum +
          seller.totalOrders,
        0
      );

    const deliveredOrders =
      sellers.reduce(
        (sum, seller) =>
          sum +
          seller.deliveredOrders,
        0
      );

    const wholesaleSales =
      sellers.reduce(
        (sum, seller) =>
          sum +
          seller.wholesaleSales,
        0
      );

    const retailSales =
      sellers.reduce(
        (sum, seller) =>
          sum +
          seller.retailSales,
        0
      );

    const sellersWithSales =
      sellers.filter(
        (seller) =>
          seller.totalSales > 0
      ).length;

    return {
      totalSellers,
      approved,
      pending,
      blocked,
      totalProducts,
      totalSales,
      totalOrders,
      deliveredOrders,
      wholesaleSales,
      retailSales,
      sellersWithSales,
    };
  }, [sellers]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading seller analytics...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="shrink-0"
            >
              <img
                src="/logo/anjivo-logo.png"
                alt="ANJIVO"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <div className="hidden border-l pl-4 sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Admin Panel
              </p>

              <h1 className="text-lg font-bold text-slate-900">
                Seller Analytics
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/sellers"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Sellers
            </Link>

            <button
              onClick={loadAnalytics}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-indigo-600">
            Marketplace Intelligence
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Seller Performance & Analytics
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Sellers ke products, orders, sales, retail/wholesale
            business aur order performance ko ek hi dashboard
            se monitor karein.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard
            label="Sellers"
            value={stats.totalSellers}
            icon="🏪"
          />

          <StatCard
            label="Approved"
            value={stats.approved}
            icon="✓"
          />

          <StatCard
            label="Pending"
            value={stats.pending}
            icon="⏳"
          />

          <StatCard
            label="Blocked"
            value={stats.blocked}
            icon="🚫"
          />

          <StatCard
            label="Products"
            value={stats.totalProducts}
            icon="📦"
          />

          <StatCard
            label="Orders"
            value={stats.totalOrders}
            icon="🧾"
          />

          <StatCard
            label="Sales"
            value={formatCurrency(
              stats.totalSales
            )}
            icon="₹"
          />

          <StatCard
            label="Sellers With Sales"
            value={stats.sellersWithSales}
            icon="📈"
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <RevenueCard
            title="Retail Sales"
            value={
              stats.retailSales
            }
            description="Retail customer sales"
          />

          <RevenueCard
            title="Wholesale Sales"
            value={
              stats.wholesaleSales
            }
            description="B2B / bulk sales"
          />

          <RevenueCard
            title="Delivered Orders"
            value={
              stats.deliveredOrders
            }
            description="Seller order deliveries"
            numeric
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_auto]">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  🔎
                </span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search seller, owner, phone, city, email..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Seller Status
                </option>

                <option value="approved">
                  Approved
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="rejected">
                  Rejected
                </option>

                <option value="blocked">
                  Blocked
                </option>
              </select>

              <select
                value={
                  performanceFilter
                }
                onChange={(event) =>
                  setPerformanceFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Performance
                </option>

                <option value="sales">
                  Sellers With Sales
                </option>

                <option value="orders">
                  Sellers With Orders
                </option>

                <option value="products">
                  Sellers With Products
                </option>

                <option value="no_sales">
                  No Sales Yet
                </option>
              </select>

              <button
                onClick={loadAnalytics}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {filteredSellers.length ===
          0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🏪
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-900">
                No sellers found
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Current filters ke according koi seller nahi mila.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSellers.map(
                (seller) => (
                  <SellerRow
                    key={seller.id}
                    seller={seller}
                    onOpen={() =>
                      setSelectedSeller(
                        seller
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>

      {selectedSeller && (
        <SellerDetailsModal
          seller={
            selectedSeller
          }
          onClose={() =>
            setSelectedSeller(
              null
            )
          }
        />
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {typeof value ===
            "number"
              ? value.toLocaleString(
                  "en-IN"
                )
              : value}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function RevenueCard({
  title,
  value,
  description,
  numeric = false,
}: {
  title: string;
  value: number;
  description: string;
  numeric?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-600">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {numeric
              ? value.toLocaleString(
                  "en-IN"
                )
              : formatCurrency(
                  value
                )}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          {numeric
            ? "✓"
            : "₹"}
        </div>
      </div>
    </div>
  );
}

function SellerRow({
  seller,
  onOpen,
}: {
  seller: SellerAnalytics;
  onOpen: () => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            {seller.businessName
              .charAt(0)
              .toUpperCase() ||
              "S"}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {seller.businessName}
              </h3>

              <SellerStatusBadge
                status={
                  seller.status
                }
              />

              {seller.sellerVerified && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  ✓ Verified
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {seller.ownerName ||
                "Owner not available"}
            </p>

            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
              <span>
                📦{" "}
                {seller.totalProducts}{" "}
                products
              </span>

              <span>
                🧾{" "}
                {seller.totalOrders}{" "}
                orders
              </span>

              <span>
                💰{" "}
                {formatCurrency(
                  seller.totalSales
                )}{" "}
                sales
              </span>

              <span>
                ✓{" "}
                {seller.deliveredOrders}{" "}
                delivered
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <div className="mr-2 text-right">
            <p className="text-[11px] text-slate-400">
              Avg Order
            </p>

            <p className="font-bold text-slate-900">
              {formatCurrency(
                seller.averageOrderValue
              )}
            </p>
          </div>

          <button
            onClick={onOpen}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Analytics
          </button>
        </div>
      </div>
    </div>
  );
}

function SellerStatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    approved:
      "bg-emerald-100 text-emerald-700",

    pending:
      "bg-amber-100 text-amber-700",

    rejected:
      "bg-red-100 text-red-700",

    blocked:
      "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        styles[status] ||
        "bg-slate-100 text-slate-600"
      }`}
    >
      {status
        .replaceAll("_", " ")
        .replace(
          /\b\w/g,
          (char) =>
            char.toUpperCase()
        )}
    </span>
  );
}

function SellerDetailsModal({
  seller,
  onClose,
}: {
  seller: SellerAnalytics;
  onClose: () => void;
}) {
  const totalSales =
    seller.totalSales;

  const retailPercentage =
    totalSales > 0
      ? (seller.retailSales /
          totalSales) *
        100
      : 0;

  const wholesalePercentage =
    totalSales > 0
      ? (seller.wholesaleSales /
          totalSales) *
        100
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Seller Analytics
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {seller.businessName}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {seller.ownerName ||
                "Owner not available"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <SellerStatusBadge
                status={
                  seller.status
                }
              />

              {seller.sellerVerified && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  ✓ Seller Verified
                </span>
              )}

              {seller.adminApproved && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  ✓ Admin Approved
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Sales"
                value={formatCurrency(
                  seller.totalSales
                )}
                icon="₹"
              />

              <MetricCard
                label="Orders"
                value={seller.totalOrders.toLocaleString(
                  "en-IN"
                )}
                icon="🧾"
              />

              <MetricCard
                label="Items Sold"
                value={seller.totalItemsSold.toLocaleString(
                  "en-IN"
                )}
                icon="📦"
              />

              <MetricCard
                label="Average Order"
                value={formatCurrency(
                  seller.averageOrderValue
                )}
                icon="📊"
              />

              <MetricCard
                label="Products"
                value={seller.totalProducts.toLocaleString(
                  "en-IN"
                )}
                icon="🛍️"
              />

              <MetricCard
                label="Active Products"
                value={seller.activeProducts.toLocaleString(
                  "en-IN"
                )}
                icon="🟢"
              />

              <MetricCard
                label="Out of Stock"
                value={seller.outOfStockProducts.toLocaleString(
                  "en-IN"
                )}
                icon="⚠️"
              />

              <MetricCard
                label="Blocked Products"
                value={seller.blockedProducts.toLocaleString(
                  "en-IN"
                )}
                icon="🚫"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-900">
                  Order Performance
                </h3>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniMetric
                    label="Delivered"
                    value={
                      seller.deliveredOrders
                    }
                  />

                  <MiniMetric
                    label="Processing"
                    value={
                      seller.processingOrders
                    }
                  />

                  <MiniMetric
                    label="Cancelled"
                    value={
                      seller.cancelledOrders
                    }
                  />

                  <MiniMetric
                    label="Returned"
                    value={
                      seller.returnedOrders
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-900">
                  Retail vs Wholesale
                </h3>

                <div className="mt-5 space-y-4">
                  <SalesProgress
                    label="Retail"
                    value={
                      seller.retailSales
                    }
                    percentage={
                      retailPercentage
                    }
                  />

                  <SalesProgress
                    label="Wholesale"
                    value={
                      seller.wholesaleSales
                    }
                    percentage={
                      wholesalePercentage
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailCard
                label="Business"
                value={
                  seller.businessName
                }
              />

              <DetailCard
                label="Owner"
                value={
                  seller.ownerName ||
                  "—"
                }
              />

              <DetailCard
                label="Phone"
                value={
                  seller.phone ||
                  "—"
                }
              />

              <DetailCard
                label="Email"
                value={
                  seller.email ||
                  "—"
                }
              />

              <DetailCard
                label="City"
                value={
                  seller.city ||
                  "—"
                }
              />

              <DetailCard
                label="State"
                value={
                  seller.state ||
                  "—"
                }
              />

              <DetailCard
                label="Category"
                value={
                  seller.category ||
                  "—"
                }
              />

              <DetailCard
                label="Seller Since"
                value={formatDate(
                  seller.createdAt
                )}
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                Analytics Note
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700">
                Sales yahan existing order line-items ke
                sellerId ke basis par calculate ho rahi hain.
                Multi-seller order mein sirf is seller ke
                items seller sales mein count hote hain.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-lg font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-slate-900">
        {value.toLocaleString(
          "en-IN"
        )}
      </p>
    </div>
  );
}

function SalesProgress({
  label,
  value,
  percentage,
}: {
  label: string;
  value: number;
  percentage: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">
          {label}
        </span>

        <span className="font-bold text-slate-900">
          {formatCurrency(value)}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900"
          style={{
            width: `${Math.min(
              100,
              Math.max(
                0,
                percentage
              )
            )}%`,
          }}
        />
      </div>

      <p className="mt-1 text-right text-[11px] text-slate-400">
        {percentage.toFixed(1)}%
      </p>
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}
