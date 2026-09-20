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

type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

type WholesaleProduct = {
  id: string;
  name: string;
  sellerId: string;
  sellerName: string;
  categoryName: string;

  retailPrice: number;
  wholesalePrice: number;
  moq: number;

  wholesaleTiers: WholesaleTier[];

  stock: number;
  status: string;

  createdAt?: unknown;
};

type WholesaleCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  customerType: string;
  accountStatus: string;
  emailVerified: boolean;
  phoneVerified: boolean;
};

type WholesaleOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: string;
  paymentStatus: string;
  items: number;
  sellerCount: number;
  createdAt?: unknown;
};

type Tab =
  | "overview"
  | "products"
  | "customers"
  | "orders";

function stringValue(value: unknown): string {
  return value === undefined || value === null
    ? ""
    : String(value);
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number)
    ? number
    : 0;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function timestampValue(value: unknown): number {
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
    return value.getTime();
  }

  return 0;
}

function mapWholesaleProduct(
  id: string,
  data: Record<string, unknown>
): WholesaleProduct {
  const rawTiers = Array.isArray(
    data.wholesaleTiers
  )
    ? data.wholesaleTiers
    : [];

  const wholesaleTiers =
    rawTiers
      .map((raw) => {
        const tier =
          raw as Record<
            string,
            unknown
          >;

        return {
          minQuantity:
            numberValue(
              tier.minQuantity
            ),

          maxQuantity:
            tier.maxQuantity !==
            undefined &&
            tier.maxQuantity !==
            null
              ? numberValue(
                  tier.maxQuantity
                )
              : undefined,

          price:
            numberValue(
              tier.price
            ),
        };
      })
      .filter(
        (tier) =>
          tier.minQuantity > 0 &&
          tier.price > 0
      )
      .sort(
        (a, b) =>
          a.minQuantity -
          b.minQuantity
      );

  return {
    id,

    name:
      stringValue(
        data.name
      ),

    sellerId:
      stringValue(
        data.sellerId
      ),

    sellerName:
      stringValue(
        data.sellerName
      ) || "Seller",

    categoryName:
      stringValue(
        data.categoryName
      ),

    retailPrice:
      numberValue(
        data.retailPrice
      ),

    wholesalePrice:
      numberValue(
        data.wholesalePrice
      ),

    moq:
      numberValue(
        data.moq
      ),

    wholesaleTiers,

    stock:
      numberValue(
        data.stock
      ),

    status:
      stringValue(
        data.status
      ) || "draft",

    createdAt:
      data.createdAt,
  };
}

export default function AdminWholesalePage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState<Tab>("overview");

  const [
    wholesaleProducts,
    setWholesaleProducts,
  ] = useState<
    WholesaleProduct[]
  >([]);

  const [
    wholesaleCustomers,
    setWholesaleCustomers,
  ] = useState<
    WholesaleCustomer[]
  >([]);

  const [
    wholesaleOrders,
    setWholesaleOrders,
  ] = useState<
    WholesaleOrder[]
  >([]);

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [processing, setProcessing] =
    useState<string | null>(null);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/wholesale";
            return;
          }

          try {
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !snapshot.exists()
            ) {
              window.location.href =
                "/";
              return;
            }

            if (
              snapshot.data()
                .role !== "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await Promise.all([
              loadProducts(),
              loadCustomers(),
              loadOrders(),
            ]);
          } catch (err) {
            console.error(err);

            setError(
              "Admin access verify nahi ho saka."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  async function loadProducts() {
    try {
      const snapshot =
        await getDocs(
          collection(
            db,
            "products"
          )
        );

      const list =
        snapshot.docs
          .map((item) =>
            mapWholesaleProduct(
              item.id,
              item.data()
            )
          )
          .filter(
            (product) =>
              product.moq > 0 ||
              product.wholesalePrice > 0 ||
              product.wholesaleTiers
                .length > 0
          );

      list.sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      );

      setWholesaleProducts(list);
    } catch (err) {
      console.error(
        "Wholesale products error:",
        err
      );

      setError(
        "Wholesale products load nahi ho paaye."
      );
    }
  }

  async function loadCustomers() {
    try {
      const snapshot =
        await getDocs(
          collection(
            db,
            "users"
          )
        );

      const list =
        snapshot.docs
          .filter(
            (item) =>
              item.data()
                .customerType ===
              "WHOLESALE_CUSTOMER"
          )
          .map(
            (item) => {
              const data =
                item.data();

              return {
                id: item.id,

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

                customerType:
                  stringValue(
                    data.customerType
                  ),

                accountStatus:
                  stringValue(
                    data.accountStatus
                  ) ||
                  "PENDING_VERIFICATION",

                emailVerified:
                  booleanValue(
                    data.emailVerified
                  ),

                phoneVerified:
                  booleanValue(
                    data.phoneVerified
                  ),
              };
            }
          );

      setWholesaleCustomers(
        list
      );
    } catch (err) {
      console.error(
        "Wholesale customers error:",
        err
      );

      setError(
        "Wholesale customers load nahi ho paaye."
      );
    }
  }

  async function loadOrders() {
    try {
      const snapshot = await getDocs(
        collection(db, "orders")
      );

      const wholesaleDocs = snapshot.docs.filter((item) => {
        const data = item.data();

        const rawItems = Array.isArray(data.items)
          ? data.items
          : [];

        const items = rawItems.map(
          (raw) =>
            raw as Record<string, unknown>
        );

        return items.some(
          (orderItem) =>
            orderItem.pricingType === "wholesale"
        );
      });

      const list: WholesaleOrder[] =
        wholesaleDocs.map((item) => {
          const data = item.data();

          const rawItems = Array.isArray(data.items)
            ? data.items
            : [];

          const items = rawItems.map(
            (raw) =>
              raw as Record<string, unknown>
          );

          const sellerIds = new Set(
            items
              .map((orderItem) =>
                stringValue(orderItem.sellerId)
              )
              .filter(Boolean)
          );

          return {
            id: item.id,

            customerName: stringValue(
              data.customerName ||
                data.name
            ),

            customerPhone: stringValue(
              data.customerPhone ||
                data.phone
            ),

            total: numberValue(
              data.total ||
                data.grandTotal
            ),

            status:
              stringValue(data.status) ||
              "pending",

            paymentStatus:
              stringValue(
                data.paymentStatus
              ) || "pending",

            items: items.length,

            sellerCount: sellerIds.size,

            createdAt:
              data.createdAt,
          };
        });

      list.sort(
        (a, b) =>
          timestampValue(b.createdAt) -
          timestampValue(a.createdAt)
      );

      setWholesaleOrders(list);
    } catch (err) {
      console.error(
        "Wholesale orders error:",
        err
      );

      setError(
        "Wholesale orders load nahi ho paaye."
      );
    }
  }

  async function toggleProductWholesale(
    product: WholesaleProduct
  ) {
    const enable =
      product.moq <= 0 ||
      product.wholesalePrice <=
        0;

    const confirmed =
      window.confirm(
        enable
          ? `Wholesale pricing enable karna hai for "${product.name}"?`
          : `Wholesale pricing disable karna hai for "${product.name}"?`
      );

    if (!confirmed) return;

    try {
      setProcessing(
        product.id
      );

      setError("");
      setSuccess("");

      if (enable) {
        await updateDoc(
          doc(
            db,
            "products",
            product.id
          ),
          {
            moq:
              product.moq > 0
                ? product.moq
                : 10,

            wholesalePrice:
              product.wholesalePrice >
              0
                ? product.wholesalePrice
                : product.retailPrice,

            updatedAt:
              serverTimestamp(),
          }
        );
      } else {
        await updateDoc(
          doc(
            db,
            "products",
            product.id
          ),
          {
            moq: 0,
            wholesalePrice: 0,
            wholesaleTiers: [],
            updatedAt:
              serverTimestamp(),
          }
        );
      }

      await loadProducts();

      setSuccess(
        enable
          ? "Wholesale pricing enabled."
          : "Wholesale pricing disabled."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Wholesale pricing update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  const filteredProducts =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return wholesaleProducts;
      }

      return wholesaleProducts.filter(
        (product) =>
          [
            product.name,
            product.sellerName,
            product.categoryName,
            product.sellerId,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
      );
    }, [
      wholesaleProducts,
      search,
    ]);

  const filteredCustomers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return wholesaleCustomers;
      }

      return wholesaleCustomers.filter(
        (customer) =>
          [
            customer.name,
            customer.email,
            customer.phone,
            customer.id,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
      );
    }, [
      wholesaleCustomers,
      search,
    ]);

  const totalWholesaleValue =
    wholesaleOrders.reduce(
      (sum, order) =>
        sum + order.total,
      0
    );

  const activeWholesaleProducts =
    wholesaleProducts.filter(
      (product) =>
        product.status === "active"
    ).length;

  const productsWithTiers =
    wholesaleProducts.filter(
      (product) =>
        product.wholesaleTiers
          .length > 0
    ).length;

  const averageMOQ =
    wholesaleProducts.length
      ? Math.round(
          wholesaleProducts.reduce(
            (sum, product) =>
              sum + product.moq,
            0
          ) /
            wholesaleProducts.length
        )
      : 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading Wholesale Management...
          </p>

        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8]">

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
              href="/admin/orders"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Orders
            </Link>

            <button
              type="button"
              onClick={() => {
                loadProducts();
                loadCustomers();
                loadOrders();
              }}
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white"
            >
              ↻ Refresh
            </button>

          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">

        <div>

          <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
            ADMIN / WHOLESALE
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Wholesale Management
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            B2B customers, wholesale products,
            MOQ, quantity tiers aur wholesale
            orders ko ek jagah manage karein.
          </p>

        </div>

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

        {/* TABS */}

        <div className="mt-7 flex overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1">

          <TabButton
            label="Overview"
            active={
              activeTab ===
              "overview"
            }
            onClick={() =>
              setActiveTab(
                "overview"
              )
            }
          />

          <TabButton
            label="Wholesale Products"
            active={
              activeTab ===
              "products"
            }
            onClick={() =>
              setActiveTab(
                "products"
              )
            }
          />

          <TabButton
            label="B2B Customers"
            active={
              activeTab ===
              "customers"
            }
            onClick={() =>
              setActiveTab(
                "customers"
              )
            }
          />

          <TabButton
            label="Wholesale Orders"
            active={
              activeTab ===
              "orders"
            }
            onClick={() =>
              setActiveTab(
                "orders"
              )
            }
          />

        </div>

        {/* OVERVIEW */}

        {activeTab ===
          "overview" && (
          <div className="mt-6">

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

              <StatCard
                label="Wholesale Products"
                value={
                  wholesaleProducts.length
                }
              />

              <StatCard
                label="Active Products"
                value={
                  activeWholesaleProducts
                }
              />

              <StatCard
                label="With Quantity Tiers"
                value={
                  productsWithTiers
                }
              />

              <StatCard
                label="B2B Customers"
                value={
                  wholesaleCustomers.length
                }
              />

              <StatCard
                label="Wholesale Orders"
                value={
                  wholesaleOrders.length
                }
              />

              <StatCard
                label="Order Value"
                value={`₹${totalWholesaleValue.toLocaleString(
                  "en-IN"
                )}`}
              />

            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">

              <div className="rounded-3xl border border-gray-200 bg-white p-6">

                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Wholesale Health
                </p>

                <h2 className="mt-2 text-xl font-black">
                  B2B Pricing Coverage
                </h2>

                <div className="mt-6 space-y-5">

                  <ProgressRow
                    label="Active Wholesale Products"
                    value={
                      wholesaleProducts.length
                        ? Math.round(
                            (activeWholesaleProducts /
                              wholesaleProducts.length) *
                              100
                          )
                        : 0
                    }
                  />

                  <ProgressRow
                    label="Products With Quantity Tiers"
                    value={
                      wholesaleProducts.length
                        ? Math.round(
                            (productsWithTiers /
                              wholesaleProducts.length) *
                              100
                          )
                        : 0
                    }
                  />

                  <div className="rounded-2xl bg-gray-50 p-4">

                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                      Average MOQ
                    </p>

                    <p className="mt-1 text-2xl font-black">
                      {averageMOQ}
                    </p>

                  </div>

                </div>

              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-6">

                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  ANJIVO B2B Model
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Wholesale Flow
                </h2>

                <div className="mt-5 space-y-3">

                  <FlowStep
                    number="01"
                    title="Seller adds MOQ"
                    text="Seller product ke liye minimum bulk quantity set karta hai."
                  />

                  <FlowStep
                    number="02"
                    title="Quantity tiers"
                    text="10, 25, 50, 100+ jaise slabs par different prices."
                  />

                  <FlowStep
                    number="03"
                    title="B2B customer"
                    text="Wholesale customer bulk quantity select karta hai."
                  />

                  <FlowStep
                    number="04"
                    title="Order splitting"
                    text="Multi-seller order ko seller-wise fulfilment ke liye split kiya jayega."
                  />

                </div>

              </div>

            </div>

          </div>
        )}

        {/* PRODUCTS */}

        {activeTab ===
          "products" && (
          <div className="mt-6">

            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search wholesale product, seller or category..."
            />

            <div className="mt-5 overflow-hidden rounded-3xl border border-gray-200 bg-white">

              {filteredProducts.length ===
              0 ? (
                <EmptyState
                  icon="📦"
                  title="No wholesale products"
                  text="Aise products nahi mile jinke paas MOQ ya wholesale pricing available ho."
                />
              ) : (
                <div className="divide-y divide-gray-100">

                  {filteredProducts.map(
                    (product) => (
                      <WholesaleProductRow
                        key={
                          product.id
                        }
                        product={
                          product
                        }
                        processing={
                          processing ===
                          product.id
                        }
                        onToggle={() =>
                          toggleProductWholesale(
                            product
                          )
                        }
                      />
                    )
                  )}

                </div>
              )}

            </div>

          </div>
        )}

        {/* CUSTOMERS */}

        {activeTab ===
          "customers" && (
          <div className="mt-6">

            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search B2B customer, email, mobile or ID..."
            />

            <div className="mt-5 overflow-hidden rounded-3xl border border-gray-200 bg-white">

              {filteredCustomers.length ===
              0 ? (
                <EmptyState
                  icon="🏢"
                  title="No B2B customers"
                  text="Abhi koi wholesale customer registered nahi mila."
                />
              ) : (
                <div className="divide-y divide-gray-100">

                  {filteredCustomers.map(
                    (customer) => (
                      <WholesaleCustomerRow
                        key={
                          customer.id
                        }
                        customer={
                          customer
                        }
                      />
                    )
                  )}

                </div>
              )}

            </div>

          </div>
        )}

        {/* ORDERS */}

        {activeTab ===
          "orders" && (
          <div className="mt-6">

            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search wholesale order, customer or mobile..."
            />

            <div className="mt-5 overflow-hidden rounded-3xl border border-gray-200 bg-white">

              {wholesaleOrders
                .filter(
                  (order) => {
                    const query =
                      search
                        .trim()
                        .toLowerCase();

                    if (!query)
                      return true;

                    return [
                      order.id,
                      order.customerName,
                      order.customerPhone,
                      order.status,
                      order.paymentStatus,
                    ]
                      .join(" ")
                      .toLowerCase()
                      .includes(
                        query
                      );
                  }
                )
                .map(
                  (order) => (
                    <WholesaleOrderRow
                      key={
                        order.id
                      }
                      order={
                        order
                      }
                    />
                  )
                )}

              {wholesaleOrders.length ===
                0 && (
                <EmptyState
                  icon="🧾"
                  title="No wholesale orders"
                  text="Wholesale pricing wale orders yahan show honge."
                />
              )}

            </div>

          </div>
        )}

      </div>
    </main>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl px-4 py-3 text-xs font-black ${
        active
          ? "bg-black text-white"
          : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">

      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-black">
        {value}
      </p>

    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
      />

    </div>
  );
}

function ProgressRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>

      <div className="flex justify-between text-xs font-bold">

        <span>{label}</span>

        <span>{value}%</span>

      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">

        <div
          className="h-full rounded-full bg-black transition-all"
          style={{
            width: `${Math.min(
              100,
              Math.max(
                0,
                value
              )
            )}%`,
          }}
        />

      </div>

    </div>
  );
}

function FlowStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-gray-50 p-4">

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-black text-white">
        {number}
      </div>

      <div>

        <p className="text-sm font-black">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-gray-500">
          {text}
        </p>

      </div>

    </div>
  );
}

function WholesaleProductRow({
  product,
  processing,
  onToggle,
}: {
  product: WholesaleProduct;
  processing: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="p-5 sm:p-6">

      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="text-base font-black">
              {product.name ||
                "Unnamed Product"}
            </h3>

            <span className="rounded-full bg-purple-100 px-3 py-1.5 text-[9px] font-black text-purple-700">
              WHOLESALE
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[9px] font-black text-gray-600">
              {product.status.toUpperCase()}
            </span>

          </div>

          <div className="mt-2 flex flex-wrap gap-2">

            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-bold">
              Seller:{" "}
              {product.sellerName ||
                product.sellerId}
            </span>

            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-bold">
              MOQ:{" "}
              {product.moq}
            </span>

            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-bold">
              Stock:{" "}
              {product.stock}
            </span>

            {product.categoryName && (
              <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-bold">
                {product.categoryName}
              </span>
            )}

          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">

            <PriceBox
              label="Retail"
              price={
                product.retailPrice
              }
            />

            <PriceBox
              label="Wholesale"
              price={
                product.wholesalePrice
              }
            />

            <PriceBox
              label="Saving"
              price={Math.max(
                0,
                product.retailPrice -
                  product.wholesalePrice
              )}
            />

          </div>

          {product.wholesaleTiers
            .length > 0 && (
            <div className="mt-4">

              <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
                Quantity Tiers
              </p>

              <div className="mt-2 flex flex-wrap gap-2">

                {product.wholesaleTiers.map(
                  (
                    tier,
                    index
                  ) => (
                    <span
                      key={`${product.id}-${index}`}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-bold"
                    >
                      {tier.minQuantity}
                      {tier.maxQuantity
                        ? `–${tier.maxQuantity}`
                        : "+"}
                      {" → "}
                      ₹
                      {tier.price.toLocaleString(
                        "en-IN"
                      )}
                    </span>
                  )
                )}

              </div>

            </div>
          )}

        </div>

        <button
          type="button"
          disabled={processing}
          onClick={onToggle}
          className={`rounded-xl px-5 py-3 text-xs font-black text-white disabled:opacity-50 ${
            product.moq > 0 ||
            product.wholesalePrice >
              0
              ? "bg-red-600"
              : "bg-black"
          }`}
        >
          {processing
            ? "Processing..."
            : product.moq > 0 ||
              product.wholesalePrice >
                0
            ? "Disable Wholesale"
            : "Enable Wholesale"}
        </button>

      </div>

    </div>
  );
}

function PriceBox({
  label,
  price,
}: {
  label: string;
  price: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">

      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-black">
        ₹
        {price.toLocaleString(
          "en-IN"
        )}
      </p>

    </div>
  );
}

function WholesaleCustomerRow({
  customer,
}: {
  customer: WholesaleCustomer;
}) {
  return (
    <div className="p-5 sm:p-6">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="text-base font-black">
              {customer.name ||
                "Unnamed Customer"}
            </h3>

            <span className="rounded-full bg-purple-100 px-3 py-1.5 text-[9px] font-black text-purple-700">
              B2B / WHOLESALE
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[9px] font-black">
              {customer.accountStatus ||
                "PENDING"}
            </span>

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

            <InfoBadge>
              Email{" "}
              {customer.emailVerified
                ? "✓"
                : "○"}
            </InfoBadge>

            <InfoBadge>
              Mobile{" "}
              {customer.phoneVerified
                ? "✓"
                : "○"}
            </InfoBadge>

          </div>

          <p className="mt-3 break-all text-[9px] text-gray-400">
            Customer ID:{" "}
            {customer.id}
          </p>

        </div>

      </div>

    </div>
  );
}

function WholesaleOrderRow({
  order,
}: {
  order: WholesaleOrder;
}) {
  return (
    <div className="border-b border-gray-100 p-5 last:border-b-0 sm:p-6">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="text-base font-black">
              #{order.id.slice(
                0,
                12
              )}
            </h3>

            <span className="rounded-full bg-purple-100 px-3 py-1.5 text-[9px] font-black text-purple-700">
              WHOLESALE
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[9px] font-black">
              {order.status.toUpperCase()}
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[9px] font-black">
              PAY:{" "}
              {order.paymentStatus.toUpperCase()}
            </span>

          </div>

          <div className="mt-3 flex flex-wrap gap-2">

            <InfoBadge>
              👤{" "}
              {order.customerName ||
                "Customer"}
            </InfoBadge>

            <InfoBadge>
              📱{" "}
              {order.customerPhone ||
                "—"}
            </InfoBadge>

            <InfoBadge>
              📦{" "}
              {order.items} items
            </InfoBadge>

            <InfoBadge>
              🏪{" "}
              {order.sellerCount} sellers
            </InfoBadge>

          </div>

        </div>

        <p className="text-xl font-black">
          ₹
          {order.total.toLocaleString(
            "en-IN"
          )}
        </p>

      </div>

    </div>
  );
}

function InfoBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-600">
      {children}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="p-14 text-center">

      <div className="text-5xl">
        {icon}
      </div>

      <h2 className="mt-4 text-lg font-black">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">
        {text}
      </p>

    </div>
  );
}
