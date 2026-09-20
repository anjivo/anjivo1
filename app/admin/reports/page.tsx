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

type ReportOrder = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  items: ReportItem[];
  createdAt?: unknown;
};

type ReportItem = {
  productId: string;
  sellerId: string;
  sellerName: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  pricingType: "retail" | "wholesale" | string;
};

type ReportProduct = {
  id: string;
  name: string;
  sellerId: string;
  sellerName: string;
  categoryName: string;
  stock: number;
  retailPrice: number;
  wholesalePrice: number;
  status: string;
  featured: boolean;
  bestSeller: boolean;
  trending: boolean;
};

type ReportSeller = {
  id: string;
  businessName: string;
  ownerName: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  status: string;
  sellerVerified: boolean;
  adminApproved: boolean;
};

type ReportCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  accountStatus: string;
  createdAt?: unknown;
};

type ReportReturn = {
  id: string;
  orderId: string;
  customerId: string;
  sellerId: string;
  productId: string;
  productName: string;
  amount: number;
  refundAmount: number;
  returnStatus: string;
  refundStatus: string;
  createdAt?: unknown;
};

type DateRange =
  | "all"
  | "today"
  | "7days"
  | "30days"
  | "90days";

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

function timestampValue(value: unknown): number {
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

function formatCurrency(value: number): string {
  return `₹${Math.round(
    value
  ).toLocaleString("en-IN")}`;
}

function formatDate(value: unknown): string {
  const time = timestampValue(value);

  if (!time) return "—";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
    }
  ).format(new Date(time));
}

function normalizeItem(
  raw: unknown
): ReportItem {
  const item =
    typeof raw === "object" &&
    raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const quantity =
    numberValue(item.quantity) || 1;

  const price =
    numberValue(item.selectedPrice) ||
    numberValue(item.price) ||
    numberValue(item.retailPrice);

  return {
    productId:
      stringValue(item.productId) ||
      stringValue(item.id),

    sellerId:
      stringValue(item.sellerId),

    sellerName:
      stringValue(item.sellerName),

    productName:
      stringValue(item.name) ||
      stringValue(item.productName),

    quantity,

    price,

    subtotal:
      numberValue(item.subtotal) ||
      price * quantity,

    pricingType:
      stringValue(item.pricingType) ||
      "retail",
  };
}

function mapOrder(
  id: string,
  data: Record<string, unknown>
): ReportOrder {
  const rawItems = Array.isArray(data.items)
    ? data.items
    : [];

  const items =
    rawItems.map(normalizeItem);

  return {
    id,

    userId:
      stringValue(data.userId) ||
      stringValue(data.customerId),

    customerName:
      stringValue(data.customerName) ||
      stringValue(data.name),

    customerEmail:
      stringValue(data.customerEmail) ||
      stringValue(data.email),

    customerPhone:
      stringValue(data.customerPhone) ||
      stringValue(data.phone),

    total:
      numberValue(data.total) ||
      numberValue(data.grandTotal),

    subtotal:
      numberValue(data.subtotal),

    shipping:
      numberValue(data.shipping) ||
      numberValue(data.shippingCharge),

    discount:
      numberValue(data.discount),

    status:
      stringValue(data.status) ||
      "pending",

    paymentStatus:
      stringValue(data.paymentStatus) ||
      "pending",

    paymentMethod:
      stringValue(data.paymentMethod),

    items,

    createdAt:
      data.createdAt,
  };
}

function mapProduct(
  id: string,
  data: Record<string, unknown>
): ReportProduct {
  return {
    id,

    name:
      stringValue(data.name) ||
      "Unnamed Product",

    sellerId:
      stringValue(data.sellerId),

    sellerName:
      stringValue(data.sellerName),

    categoryName:
      stringValue(data.categoryName),

    stock:
      numberValue(data.stock),

    retailPrice:
      numberValue(data.retailPrice),

    wholesalePrice:
      numberValue(data.wholesalePrice),

    status:
      stringValue(data.status) ||
      "draft",

    featured:
      booleanValue(data.featured),

    bestSeller:
      booleanValue(data.bestSeller),

    trending:
      booleanValue(data.trending),
  };
}

function mapSeller(
  id: string,
  data: Record<string, unknown>
): ReportSeller {
  return {
    id,

    businessName:
      stringValue(data.businessName),

    ownerName:
      stringValue(data.ownerName),

    city:
      stringValue(data.city),

    state:
      stringValue(data.state),

    phone:
      stringValue(data.phone),

    email:
      stringValue(data.email),

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
  };
}

function mapCustomer(
  id: string,
  data: Record<string, unknown>
): ReportCustomer {
  return {
    id,

    name:
      stringValue(data.name),

    email:
      stringValue(data.email),

    phone:
      stringValue(data.phone),

    role:
      stringValue(data.role),

    accountStatus:
      stringValue(
        data.accountStatus
      ) || "ACTIVE",

    createdAt:
      data.createdAt,
  };
}

function mapReturn(
  id: string,
  data: Record<string, unknown>
): ReportReturn {
  return {
    id,

    orderId:
      stringValue(data.orderId),

    customerId:
      stringValue(data.customerId),

    sellerId:
      stringValue(data.sellerId),

    productId:
      stringValue(data.productId),

    productName:
      stringValue(data.productName),

    amount:
      numberValue(data.amount),

    refundAmount:
      numberValue(data.refundAmount),

    returnStatus:
      stringValue(
        data.returnStatus
      ) || "requested",

    refundStatus:
      stringValue(
        data.refundStatus
      ) || "pending",

    createdAt:
      data.createdAt,
  };
}

function isWithinRange(
  value: unknown,
  range: DateRange
): boolean {
  if (range === "all") return true;

  const time =
    timestampValue(value);

  if (!time) return false;

  const now = Date.now();

  if (range === "today") {
    const today = new Date();

    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();

    return time >= start;
  }

  const days =
    range === "7days"
      ? 7
      : range === "30days"
        ? 30
        : 90;

  return (
    time >=
    now -
      days *
        24 *
        60 *
        60 *
        1000
  );
}

export default function AdminReportsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [orders, setOrders] =
    useState<ReportOrder[]>([]);

  const [products, setProducts] =
    useState<ReportProduct[]>([]);

  const [sellers, setSellers] =
    useState<ReportSeller[]>([]);

  const [customers, setCustomers] =
    useState<ReportCustomer[]>([]);

  const [returns, setReturns] =
    useState<ReportReturn[]>([]);

  const [dateRange, setDateRange] =
    useState<DateRange>("30days");

  const [activeSection, setActiveSection] =
    useState<
      | "overview"
      | "sales"
      | "products"
      | "sellers"
      | "customers"
      | "returns"
    >("overview");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/reports";
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

            await loadReports();
          } catch (error) {
            console.error(
              "Admin reports authorization error:",
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

  async function loadReports() {
    try {
      const [
        ordersSnapshot,
        productsSnapshot,
        sellersSnapshot,
        customersSnapshot,
        returnsSnapshot,
      ] = await Promise.all([
        getDocs(
          collection(
            db,
            "orders"
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
            "sellers"
          )
        ),

        getDocs(
          collection(
            db,
            "users"
          )
        ),

        getDocs(
          collection(
            db,
            "returns"
          )
        ),
      ]);

      const orderList =
        ordersSnapshot.docs.map(
          (item) =>
            mapOrder(
              item.id,
              item.data()
            )
        );

      const productList =
        productsSnapshot.docs.map(
          (item) =>
            mapProduct(
              item.id,
              item.data()
            )
        );

      const sellerList =
        sellersSnapshot.docs.map(
          (item) =>
            mapSeller(
              item.id,
              item.data()
            )
        );

      const customerList =
        customersSnapshot.docs
          .map((item) =>
            mapCustomer(
              item.id,
              item.data()
            )
          )
          .filter(
            (item) =>
              item.role ===
                "RETAIL_CUSTOMER" ||
              item.role ===
                "WHOLESALE_CUSTOMER"
          );

      const returnList =
        returnsSnapshot.docs.map(
          (item) =>
            mapReturn(
              item.id,
              item.data()
            )
        );

      orderList.sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      );

      setOrders(orderList);
      setProducts(productList);
      setSellers(sellerList);
      setCustomers(customerList);
      setReturns(returnList);
    } catch (error) {
      console.error(
        "Load reports error:",
        error
      );

      alert(
        "Reports load nahi ho paaye. Firestore collections/rules check karein."
      );
    }
  }

  const filteredOrders =
    useMemo(
      () =>
        orders.filter((order) =>
          isWithinRange(
            order.createdAt,
            dateRange
          )
        ),
      [orders, dateRange]
    );

  const filteredReturns =
    useMemo(
      () =>
        returns.filter((item) =>
          isWithinRange(
            item.createdAt,
            dateRange
          )
        ),
      [returns, dateRange]
    );

  const metrics = useMemo(() => {
    const validOrders =
      filteredOrders.filter(
        (order) =>
          order.status !==
            "cancelled" &&
          order.status !==
            "returned"
      );

    const deliveredOrders =
      filteredOrders.filter(
        (order) =>
          order.status ===
          "delivered"
      );

    const pendingOrders =
      filteredOrders.filter(
        (order) =>
          [
            "pending",
            "confirmed",
            "processing",
            "shipped",
          ].includes(
            order.status
          )
      );

    const cancelledOrders =
      filteredOrders.filter(
        (order) =>
          order.status ===
          "cancelled"
      );

    const retailOrders =
      filteredOrders.filter(
        (order) =>
          order.items.some(
            (item) =>
              item.pricingType ===
              "retail"
          )
      );

    const wholesaleOrders =
      filteredOrders.filter(
        (order) =>
          order.items.some(
            (item) =>
              item.pricingType ===
              "wholesale"
          )
      );

    const revenue =
      validOrders.reduce(
        (sum, order) =>
          sum + order.total,
        0
      );

    const deliveredRevenue =
      deliveredOrders.reduce(
        (sum, order) =>
          sum + order.total,
        0
      );

    const discount =
      filteredOrders.reduce(
        (sum, order) =>
          sum + order.discount,
        0
      );

    const shipping =
      filteredOrders.reduce(
        (sum, order) =>
          sum + order.shipping,
        0
      );

    const itemsSold =
      validOrders.reduce(
        (sum, order) =>
          sum +
          order.items.reduce(
            (
              itemSum,
              item
            ) =>
              itemSum +
              item.quantity,
            0
          ),
        0
      );

    const retailRevenue =
      validOrders.reduce(
        (sum, order) =>
          sum +
          order.items
            .filter(
              (item) =>
                item.pricingType ===
                "retail"
            )
            .reduce(
              (
                itemSum,
                item
              ) =>
                itemSum +
                item.subtotal,
              0
            ),
        0
      );

    const wholesaleRevenue =
      validOrders.reduce(
        (sum, order) =>
          sum +
          order.items
            .filter(
              (item) =>
                item.pricingType ===
                "wholesale"
            )
            .reduce(
              (
                itemSum,
                item
              ) =>
                itemSum +
                item.subtotal,
              0
            ),
        0
      );

    const averageOrderValue =
      filteredOrders.length
        ? revenue /
          filteredOrders.length
        : 0;

    const refundAmount =
      filteredReturns.reduce(
        (sum, item) =>
          sum +
          (item.refundAmount ||
            0),
        0
      );

    const returnAmount =
      filteredReturns.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    return {
      totalOrders:
        filteredOrders.length,

      validOrders:
        validOrders.length,

      deliveredOrders:
        deliveredOrders.length,

      pendingOrders:
        pendingOrders.length,

      cancelledOrders:
        cancelledOrders.length,

      retailOrders:
        retailOrders.length,

      wholesaleOrders:
        wholesaleOrders.length,

      revenue,

      deliveredRevenue,

      discount,

      shipping,

      itemsSold,

      retailRevenue,

      wholesaleRevenue,

      averageOrderValue,

      returnCount:
        filteredReturns.length,

      returnAmount,

      refundAmount,
    };
  }, [
    filteredOrders,
    filteredReturns,
  ]);

  const productAnalytics =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            id: string;
            name: string;
            sellerName: string;
            quantity: number;
            revenue: number;
          }
        >();

      filteredOrders.forEach(
        (order) => {
          if (
            order.status ===
              "cancelled" ||
            order.status ===
              "returned"
          ) {
            return;
          }

          order.items.forEach(
            (item) => {
              const existing =
                map.get(
                  item.productId
                );

              if (existing) {
                existing.quantity +=
                  item.quantity;

                existing.revenue +=
                  item.subtotal;
              } else {
                map.set(
                  item.productId,
                  {
                    id:
                      item.productId,
                    name:
                      item.productName ||
                      "Unknown Product",
                    sellerName:
                      item.sellerName ||
                      "Unknown Seller",
                    quantity:
                      item.quantity,
                    revenue:
                      item.subtotal,
                  }
                );
              }
            }
          );
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.revenue -
          a.revenue
      );
    }, [filteredOrders]);

  const sellerAnalytics =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            id: string;
            name: string;
            orders: number;
            items: number;
            revenue: number;
            retailRevenue: number;
            wholesaleRevenue: number;
          }
        >();

      filteredOrders.forEach(
        (order) => {
          if (
            order.status ===
              "cancelled" ||
            order.status ===
              "returned"
          ) {
            return;
          }

          const sellerIds =
            new Set<string>();

          order.items.forEach(
            (item) => {
              if (
                !item.sellerId
              ) {
                return;
              }

              sellerIds.add(
                item.sellerId
              );

              const existing =
                map.get(
                  item.sellerId
                );

              if (existing) {
                existing.items +=
                  item.quantity;

                existing.revenue +=
                  item.subtotal;

                if (
                  item.pricingType ===
                  "wholesale"
                ) {
                  existing.wholesaleRevenue +=
                    item.subtotal;
                } else {
                  existing.retailRevenue +=
                    item.subtotal;
                }
              } else {
                map.set(
                  item.sellerId,
                  {
                    id:
                      item.sellerId,
                    name:
                      item.sellerName ||
                      "Unknown Seller",
                    orders: 0,
                    items:
                      item.quantity,
                    revenue:
                      item.subtotal,
                    retailRevenue:
                      item.pricingType ===
                      "retail"
                        ? item.subtotal
                        : 0,
                    wholesaleRevenue:
                      item.pricingType ===
                      "wholesale"
                        ? item.subtotal
                        : 0,
                  }
                );
              }
            }
          );

          sellerIds.forEach(
            (sellerId) => {
              const seller =
                map.get(
                  sellerId
                );

              if (seller) {
                seller.orders +=
                  1;
              }
            }
          );
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.revenue -
          a.revenue
      );
    }, [filteredOrders]);

  const customerAnalytics =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            id: string;
            name: string;
            email: string;
            orders: number;
            spend: number;
          }
        >();

      filteredOrders.forEach(
        (order) => {
          if (
            !order.userId
          ) {
            return;
          }

          if (
            order.status ===
              "cancelled" ||
            order.status ===
              "returned"
          ) {
            return;
          }

          const existing =
            map.get(
              order.userId
            );

          if (existing) {
            existing.orders +=
              1;

            existing.spend +=
              order.total;
          } else {
            map.set(
              order.userId,
              {
                id:
                  order.userId,
                name:
                  order.customerName ||
                  "Customer",
                email:
                  order.customerEmail,
                orders: 1,
                spend:
                  order.total,
              }
            );
          }
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.spend -
          a.spend
      );
    }, [filteredOrders]);

  const categoryAnalytics =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            name: string;
            quantity: number;
            revenue: number;
          }
        >();

      const productMap =
        new Map(
          products.map(
            (product) => [
              product.id,
              product,
            ]
          )
        );

      filteredOrders.forEach(
        (order) => {
          if (
            order.status ===
              "cancelled" ||
            order.status ===
              "returned"
          ) {
            return;
          }

          order.items.forEach(
            (item) => {
              const product =
                productMap.get(
                  item.productId
                );

              const category =
                product
                  ?.categoryName ||
                "Uncategorized";

              const existing =
                map.get(
                  category
                );

              if (existing) {
                existing.quantity +=
                  item.quantity;

                existing.revenue +=
                  item.subtotal;
              } else {
                map.set(
                  category,
                  {
                    name:
                      category,
                    quantity:
                      item.quantity,
                    revenue:
                      item.subtotal,
                  }
                );
              }
            }
          );
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.revenue -
          a.revenue
      );
    }, [
      filteredOrders,
      products,
    ]);

  const paymentAnalytics =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            method: string;
            orders: number;
            amount: number;
          }
        >();

      filteredOrders.forEach(
        (order) => {
          if (
            order.status ===
              "cancelled" ||
            order.status ===
              "returned"
          ) {
            return;
          }

          const method =
            order.paymentMethod ||
            "unknown";

          const existing =
            map.get(
              method
            );

          if (existing) {
            existing.orders +=
              1;

            existing.amount +=
              order.total;
          } else {
            map.set(
              method,
              {
                method,
                orders: 1,
                amount:
                  order.total,
              }
            );
          }
        }
      );

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.amount -
          a.amount
      );
    }, [filteredOrders]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading reports...
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
            <Link href="/admin">
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
                Reports & Analytics
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin"
              className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Dashboard
            </Link>

            <button
              onClick={loadReports}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              Business Intelligence
            </p>

            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              ANJIVO Reports
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Marketplace ke sales, products, sellers,
              customers, payments aur returns ka centralized
              analytics dashboard.
            </p>
          </div>

          <select
            value={dateRange}
            onChange={(event) =>
              setDateRange(
                event.target.value as DateRange
              )
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
          >
            <option value="all">
              All Time
            </option>

            <option value="today">
              Today
            </option>

            <option value="7days">
              Last 7 Days
            </option>

            <option value="30days">
              Last 30 Days
            </option>

            <option value="90days">
              Last 90 Days
            </option>
          </select>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {[
            ["overview", "Overview"],
            ["sales", "Sales"],
            ["products", "Products"],
            ["sellers", "Sellers"],
            ["customers", "Customers"],
            ["returns", "Returns"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() =>
                setActiveSection(
                  value as typeof activeSection
                )
              }
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${
                activeSection === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeSection ===
          "overview" && (
          <OverviewSection
            metrics={metrics}
            paymentAnalytics={
              paymentAnalytics
            }
            categoryAnalytics={
              categoryAnalytics
            }
          />
        )}

        {activeSection ===
          "sales" && (
          <SalesSection
            metrics={metrics}
            orders={filteredOrders}
          />
        )}

        {activeSection ===
          "products" && (
          <ProductsSection
            analytics={
              productAnalytics
            }
            products={products}
          />
        )}

        {activeSection ===
          "sellers" && (
          <SellersSection
            analytics={
              sellerAnalytics
            }
            sellers={sellers}
          />
        )}

        {activeSection ===
          "customers" && (
          <CustomersSection
            analytics={
              customerAnalytics
            }
            customers={
              customers
            }
          />
        )}

        {activeSection ===
          "returns" && (
          <ReturnsSection
            returns={
              filteredReturns
            }
            metrics={metrics}
          />
        )}

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-bold text-amber-900">
            Analytics Note
          </h3>

          <p className="mt-1 text-xs leading-5 text-amber-800">
            Ye dashboard Firestore ke current order, product,
            seller, user aur return documents se analytics
            calculate karta hai. Production scale par daily/monthly
            aggregation, server-side reporting aur payment/refund
            reconciliation add karna better rahega.
          </p>
        </div>
      </div>
    </main>
  );
}

function OverviewSection({
  metrics,
  paymentAnalytics,
  categoryAnalytics,
}: {
  metrics: ReturnType<
    typeof calculateMetrics
  >;
  paymentAnalytics: {
    method: string;
    orders: number;
    amount: number;
  }[];
  categoryAnalytics: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
}) {
  return (
    <div className="mt-6 space-y-6">
      <MetricGrid metrics={metrics} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Payment Methods">
          {paymentAnalytics.length === 0 ? (
            <EmptyMini />
          ) : (
            <div className="space-y-3">
              {paymentAnalytics
                .slice(0, 8)
                .map((item) => (
                  <div
                    key={item.method}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {item.method
                          .replaceAll(
                            "_",
                            " "
                          )
                          .replace(
                            /\b\w/g,
                            (char) =>
                              char.toUpperCase()
                          )}
                      </p>

                      <p className="text-xs text-slate-500">
                        {item.orders} orders
                      </p>
                    </div>

                    <p className="text-sm font-bold text-slate-900">
                      {formatCurrency(
                        item.amount
                      )}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </Panel>

        <Panel title="Top Categories">
          {categoryAnalytics.length === 0 ? (
            <EmptyMini />
          ) : (
            <div className="space-y-3">
              {categoryAnalytics
                .slice(0, 8)
                .map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {item.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.quantity} units
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-slate-900">
                      {formatCurrency(
                        item.revenue
                      )}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function calculateMetrics(
  orders: ReportOrder[],
  returns: ReportReturn[]
) {
  const validOrders =
    orders.filter(
      (order) =>
        order.status !==
          "cancelled" &&
        order.status !==
          "returned"
    );

  const deliveredOrders =
    orders.filter(
      (order) =>
        order.status ===
        "delivered"
    );

  const pendingOrders =
    orders.filter((order) =>
      [
        "pending",
        "confirmed",
        "processing",
        "shipped",
      ].includes(
        order.status
      )
    );

  const cancelledOrders =
    orders.filter(
      (order) =>
        order.status ===
        "cancelled"
    );

  const retailOrders =
    orders.filter((order) =>
      order.items.some(
        (item) =>
          item.pricingType ===
          "retail"
      )
    );

  const wholesaleOrders =
    orders.filter((order) =>
      order.items.some(
        (item) =>
          item.pricingType ===
          "wholesale"
      )
    );

  const revenue =
    validOrders.reduce(
      (sum, order) =>
        sum + order.total,
      0
    );

  const deliveredRevenue =
    deliveredOrders.reduce(
      (sum, order) =>
        sum + order.total,
      0
    );

  const discount =
    orders.reduce(
      (sum, order) =>
        sum + order.discount,
      0
    );

  const shipping =
    orders.reduce(
      (sum, order) =>
        sum + order.shipping,
      0
    );

  const itemsSold =
    validOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (
            itemSum,
            item
          ) =>
            itemSum +
            item.quantity,
          0
        ),
      0
    );

  const retailRevenue =
    validOrders.reduce(
      (sum, order) =>
        sum +
        order.items
          .filter(
            (item) =>
              item.pricingType ===
              "retail"
          )
          .reduce(
            (
              itemSum,
              item
            ) =>
              itemSum +
              item.subtotal,
            0
          ),
      0
    );

  const wholesaleRevenue =
    validOrders.reduce(
      (sum, order) =>
        sum +
        order.items
          .filter(
            (item) =>
              item.pricingType ===
              "wholesale"
          )
          .reduce(
            (
              itemSum,
              item
            ) =>
              itemSum +
              item.subtotal,
            0
          ),
      0
    );

  const averageOrderValue =
    orders.length
      ? revenue / orders.length
      : 0;

  const refundAmount =
    returns.reduce(
      (sum, item) =>
        sum +
        item.refundAmount,
      0
    );

  return {
    totalOrders:
      orders.length,
    validOrders:
      validOrders.length,
    deliveredOrders:
      deliveredOrders.length,
    pendingOrders:
      pendingOrders.length,
    cancelledOrders:
      cancelledOrders.length,
    retailOrders:
      retailOrders.length,
    wholesaleOrders:
      wholesaleOrders.length,
    revenue,
    deliveredRevenue,
    discount,
    shipping,
    itemsSold,
    retailRevenue,
    wholesaleRevenue,
    averageOrderValue,
    returnCount:
      returns.length,
    returnAmount:
      returns.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      ),
    refundAmount,
  };
}

function MetricGrid({
  metrics,
}: {
  metrics: ReturnType<
    typeof calculateMetrics
  >;
}) {
  const cards = [
    [
      "Revenue",
      formatCurrency(
        metrics.revenue
      ),
      "₹",
    ],
    [
      "Orders",
      metrics.totalOrders,
      "🛒",
    ],
    [
      "Items Sold",
      metrics.itemsSold,
      "📦",
    ],
    [
      "Avg Order",
      formatCurrency(
        metrics.averageOrderValue
      ),
      "↗",
    ],
    [
      "Delivered",
      metrics.deliveredOrders,
      "✓",
    ],
    [
      "Pending",
      metrics.pendingOrders,
      "⏳",
    ],
    [
      "Retail Revenue",
      formatCurrency(
        metrics.retailRevenue
      ),
      "R",
    ],
    [
      "Wholesale Revenue",
      formatCurrency(
        metrics.wholesaleRevenue
      ),
      "W",
    ],
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map(
        ([label, value, icon]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
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

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                {icon}
              </span>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function SalesSection({
  metrics,
  orders,
}: {
  metrics: ReturnType<
    typeof calculateMetrics
  >;
  orders: ReportOrder[];
}) {
  const statusCounts =
    useMemo(() => {
      const map =
        new Map<
          string,
          number
        >();

      orders.forEach(
        (order) => {
          map.set(
            order.status,
            (map.get(
              order.status
            ) || 0) + 1
          );
        }
      );

      return Array.from(
        map.entries()
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );
    }, [orders]);

  return (
    <div className="mt-6 space-y-6">
      <MetricGrid metrics={metrics} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Order Status">
          <div className="space-y-3">
            {statusCounts.map(
              ([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                >
                  <span className="text-sm font-semibold capitalize text-slate-700">
                    {status.replaceAll(
                      "_",
                      " "
                    )}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {count}
                  </span>
                </div>
              )
            )}
          </div>
        </Panel>

        <Panel title="Revenue Breakdown">
          <div className="space-y-4">
            <BreakdownRow
              label="Retail"
              amount={
                metrics.retailRevenue
              }
              total={
                metrics.revenue
              }
            />

            <BreakdownRow
              label="Wholesale"
              amount={
                metrics.wholesaleRevenue
              }
              total={
                metrics.revenue
              }
            />

            <BreakdownRow
              label="Shipping"
              amount={
                metrics.shipping
              }
              total={
                metrics.revenue
              }
            />

            <BreakdownRow
              label="Discounts"
              amount={
                metrics.discount
              }
              total={
                metrics.revenue
              }
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ProductsSection({
  analytics,
  products,
}: {
  analytics: {
    id: string;
    name: string;
    sellerName: string;
    quantity: number;
    revenue: number;
  }[];
  products: ReportProduct[];
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SimpleStat
          label="Total Products"
          value={
            products.length
          }
        />

        <SimpleStat
          label="Active"
          value={
            products.filter(
              (item) =>
                item.status ===
                "active"
            ).length
          }
        />

        <SimpleStat
          label="Out of Stock"
          value={
            products.filter(
              (item) =>
                item.status ===
                  "out_of_stock" ||
                item.stock <= 0
            ).length
          }
        />

        <SimpleStat
          label="Blocked"
          value={
            products.filter(
              (item) =>
                item.status ===
                "blocked"
            ).length
          }
        />
      </div>

      <Panel title="Top Products by Sales">
        {analytics.length === 0 ? (
          <EmptyMini />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">
                    #
                  </th>

                  <th className="px-3 py-3">
                    Product
                  </th>

                  <th className="px-3 py-3">
                    Seller
                  </th>

                  <th className="px-3 py-3">
                    Units
                  </th>

                  <th className="px-3 py-3 text-right">
                    Revenue
                  </th>
                </tr>
              </thead>

              <tbody>
                {analytics
                  .slice(0, 20)
                  .map(
                    (
                      item,
                      index
                    ) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-b border-slate-50"
                      >
                        <td className="px-3 py-4 text-sm font-bold text-slate-400">
                          {index +
                            1}
                        </td>

                        <td className="px-3 py-4">
                          <p className="max-w-xs truncate text-sm font-semibold text-slate-800">
                            {item.name}
                          </p>

                          <p className="font-mono text-[10px] text-slate-400">
                            {item.id}
                          </p>
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-600">
                          {item.sellerName ||
                            "—"}
                        </td>

                        <td className="px-3 py-4 text-sm font-semibold text-slate-700">
                          {item.quantity.toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        <td className="px-3 py-4 text-right text-sm font-bold text-slate-900">
                          {formatCurrency(
                            item.revenue
                          )}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function SellersSection({
  analytics,
  sellers,
}: {
  analytics: {
    id: string;
    name: string;
    orders: number;
    items: number;
    revenue: number;
    retailRevenue: number;
    wholesaleRevenue: number;
  }[];
  sellers: ReportSeller[];
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SimpleStat
          label="Total Sellers"
          value={
            sellers.length
          }
        />

        <SimpleStat
          label="Approved"
          value={
            sellers.filter(
              (item) =>
                item.status ===
                "approved"
            ).length
          }
        />

        <SimpleStat
          label="Verified"
          value={
            sellers.filter(
              (item) =>
                item.sellerVerified
            ).length
          }
        />

        <SimpleStat
          label="Pending"
          value={
            sellers.filter(
              (item) =>
                item.status ===
                "pending"
            ).length
          }
        />
      </div>

      <Panel title="Seller Performance">
        {analytics.length === 0 ? (
          <EmptyMini />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">
                    #
                  </th>

                  <th className="px-3 py-3">
                    Seller
                  </th>

                  <th className="px-3 py-3">
                    Orders
                  </th>

                  <th className="px-3 py-3">
                    Units
                  </th>

                  <th className="px-3 py-3">
                    Retail
                  </th>

                  <th className="px-3 py-3">
                    Wholesale
                  </th>

                  <th className="px-3 py-3 text-right">
                    Revenue
                  </th>
                </tr>
              </thead>

              <tbody>
                {analytics
                  .slice(0, 30)
                  .map(
                    (
                      item,
                      index
                    ) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-b border-slate-50"
                      >
                        <td className="px-3 py-4 text-sm font-bold text-slate-400">
                          {index +
                            1}
                        </td>

                        <td className="px-3 py-4">
                          <p className="text-sm font-semibold text-slate-800">
                            {item.name}
                          </p>

                          <p className="font-mono text-[10px] text-slate-400">
                            {item.id}
                          </p>
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-700">
                          {item.orders}
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-700">
                          {item.items}
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-700">
                          {formatCurrency(
                            item.retailRevenue
                          )}
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-700">
                          {formatCurrency(
                            item.wholesaleRevenue
                          )}
                        </td>

                        <td className="px-3 py-4 text-right text-sm font-bold text-slate-900">
                          {formatCurrency(
                            item.revenue
                          )}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CustomersSection({
  analytics,
  customers,
}: {
  analytics: {
    id: string;
    name: string;
    email: string;
    orders: number;
    spend: number;
  }[];
  customers: ReportCustomer[];
}) {
  const retailCustomers =
    customers.filter(
      (item) =>
        item.role ===
        "RETAIL_CUSTOMER"
    ).length;

  const wholesaleCustomers =
    customers.filter(
      (item) =>
        item.role ===
        "WHOLESALE_CUSTOMER"
    ).length;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SimpleStat
          label="Customers"
          value={
            customers.length
          }
        />

        <SimpleStat
          label="Retail"
          value={
            retailCustomers
          }
        />

        <SimpleStat
          label="Wholesale"
          value={
            wholesaleCustomers
          }
        />

        <SimpleStat
          label="Active"
          value={
            customers.filter(
              (item) =>
                item.accountStatus ===
                "ACTIVE"
            ).length
          }
        />
      </div>

      <Panel title="Top Customers by Spend">
        {analytics.length === 0 ? (
          <EmptyMini />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">
                    #
                  </th>

                  <th className="px-3 py-3">
                    Customer
                  </th>

                  <th className="px-3 py-3">
                    Orders
                  </th>

                  <th className="px-3 py-3 text-right">
                    Spend
                  </th>
                </tr>
              </thead>

              <tbody>
                {analytics
                  .slice(0, 30)
                  .map(
                    (
                      item,
                      index
                    ) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-b border-slate-50"
                      >
                        <td className="px-3 py-4 text-sm font-bold text-slate-400">
                          {index +
                            1}
                        </td>

                        <td className="px-3 py-4">
                          <p className="text-sm font-semibold text-slate-800">
                            {item.name ||
                              "Customer"}
                          </p>

                          <p className="text-xs text-slate-500">
                            {item.email ||
                              "No email"}
                          </p>
                        </td>

                        <td className="px-3 py-4 text-sm font-semibold text-slate-700">
                          {item.orders}
                        </td>

                        <td className="px-3 py-4 text-right text-sm font-bold text-slate-900">
                          {formatCurrency(
                            item.spend
                          )}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReturnsSection({
  returns,
  metrics,
}: {
  returns: ReportReturn[];
  metrics: ReturnType<
    typeof calculateMetrics
  >;
}) {
  const completedRefunds =
    returns.filter(
      (item) =>
        item.refundStatus ===
        "completed"
    );

  const pendingRefunds =
    returns.filter((item) =>
      [
        "pending",
        "approved",
        "initiated",
      ].includes(
        item.refundStatus
      )
    );

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SimpleStat
          label="Return Requests"
          value={
            metrics.returnCount
          }
        />

        <SimpleStat
          label="Return Value"
          value={formatCurrency(
            metrics.returnAmount
          )}
        />

        <SimpleStat
          label="Refund Amount"
          value={formatCurrency(
            metrics.refundAmount
          )}
        />

        <SimpleStat
          label="Completed Refunds"
          value={
            completedRefunds.length
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Refund Pipeline">
          <div className="space-y-3">
            <BreakdownRow
              label="Pending Refunds"
              amount={pendingRefunds.reduce(
                (sum, item) =>
                  sum +
                  item.refundAmount,
                0
              )}
              total={
                metrics.refundAmount
              }
            />

            <BreakdownRow
              label="Completed Refunds"
              amount={completedRefunds.reduce(
                (sum, item) =>
                  sum +
                  item.refundAmount,
                0
              )}
              total={
                metrics.refundAmount
              }
            />
          </div>
        </Panel>

        <Panel title="Latest Returns">
          {returns.length === 0 ? (
            <EmptyMini />
          ) : (
            <div className="space-y-3">
              {returns
                .slice(0, 8)
                .map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {item.productName ||
                            "Product"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Order #
                          {
                            item.orderId
                          }
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-slate-900">
                        {formatCurrency(
                          item.refundAmount
                        )}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-600">
                        {item.returnStatus.replaceAll(
                          "_",
                          " "
                        )}
                      </span>

                      <span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-bold capitalize text-purple-700">
                        {item.refundStatus.replaceAll(
                          "_",
                          " "
                        )}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-base font-bold text-slate-900">
        {title}
      </h3>

      <div className="mt-4">
        {children}
      </div>
    </section>
  );
}

function SimpleStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {typeof value ===
        "number"
          ? value.toLocaleString(
              "en-IN"
            )
          : value}
      </p>
    </div>
  );
}

function BreakdownRow({
  label,
  amount,
  total,
}: {
  label: string;
  amount: number;
  total: number;
}) {
  const percentage =
    total > 0
      ? Math.min(
          100,
          Math.round(
            (amount / total) *
              100
          )
        )
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-slate-700">
          {label}
        </span>

        <span className="text-sm font-bold text-slate-900">
          {formatCurrency(
            amount
          )}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <p className="mt-1 text-right text-[10px] text-slate-400">
        {percentage}% of total
      </p>
    </div>
  );
}

function EmptyMini() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <p className="text-sm text-slate-500">
        No data available for the selected period.
      </p>
    </div>
  );
}
