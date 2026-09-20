"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type DiscountType = "percentage" | "fixed";

type CouponStatus =
  | "active"
  | "scheduled"
  | "expired"
  | "disabled";

type CustomerType =
  | "all"
  | "retail"
  | "wholesale";

type Coupon = {
  id: string;
  code: string;
  title: string;
  description: string;

  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number;
  minOrderValue: number;

  usageLimit: number;
  usedCount: number;
  perCustomerLimit: number;

  customerType: CustomerType;
  firstOrderOnly: boolean;

  sellerId: string;
  categoryId: string;
  productId: string;

  startsAt?: unknown;
  expiresAt?: unknown;

  status: CouponStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type FormState = {
  code: string;
  title: string;
  description: string;

  discountType: DiscountType;
  discountValue: string;
  maxDiscount: string;
  minOrderValue: string;

  usageLimit: string;
  perCustomerLimit: string;

  customerType: CustomerType;
  firstOrderOnly: boolean;

  sellerId: string;
  categoryId: string;
  productId: string;

  startsAt: string;
  expiresAt: string;

  status: CouponStatus;
};

const EMPTY_FORM: FormState = {
  code: "",
  title: "",
  description: "",

  discountType: "percentage",
  discountValue: "",
  maxDiscount: "",
  minOrderValue: "0",

  usageLimit: "0",
  perCustomerLimit: "1",

  customerType: "all",
  firstOrderOnly: false,

  sellerId: "",
  categoryId: "",
  productId: "",

  startsAt: "",
  expiresAt: "",

  status: "active",
};

function stringValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
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
  if (!value) {
    return 0;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    return (
      Number(
        (value as {
          seconds?: unknown;
        }).seconds ?? 0
      ) * 1000
    );
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const parsed = new Date(value).getTime();

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function toDateTimeLocal(
  value: unknown
): string {
  const timestamp = timestampValue(value);

  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  const offset =
    date.getTimezoneOffset();

  const local = new Date(
    date.getTime() -
      offset * 60 * 1000
  );

  return local
    .toISOString()
    .slice(0, 16);
}

function calculateStatus(
  status: CouponStatus,
  startsAt: unknown,
  expiresAt: unknown
): CouponStatus {
  if (status === "disabled") {
    return "disabled";
  }

  const now = Date.now();

  const start =
    timestampValue(startsAt);

  const expiry =
    timestampValue(expiresAt);

  if (expiry && expiry < now) {
    return "expired";
  }

  if (start && start > now) {
    return "scheduled";
  }

  return "active";
}

function mapCoupon(
  id: string,
  data: Record<string, unknown>
): Coupon {
  const startsAt =
    data.startsAt;

  const expiresAt =
    data.expiresAt;

  const storedStatus =
    stringValue(data.status) ||
    "active";

  const status =
    storedStatus === "disabled"
      ? "disabled"
      : storedStatus === "scheduled"
        ? "scheduled"
        : storedStatus === "expired"
          ? "expired"
          : "active";

  return {
    id,

    code:
      stringValue(data.code)
        .trim()
        .toUpperCase(),

    title:
      stringValue(data.title),

    description:
      stringValue(data.description),

    discountType:
      stringValue(
        data.discountType
      ) === "fixed"
        ? "fixed"
        : "percentage",

    discountValue:
      numberValue(
        data.discountValue
      ),

    maxDiscount:
      numberValue(
        data.maxDiscount
      ),

    minOrderValue:
      numberValue(
        data.minOrderValue
      ),

    usageLimit:
      numberValue(
        data.usageLimit
      ),

    usedCount:
      numberValue(
        data.usedCount
      ),

    perCustomerLimit:
      numberValue(
        data.perCustomerLimit
      ) || 1,

    customerType:
      stringValue(
        data.customerType
      ) === "retail"
        ? "retail"
        : stringValue(
              data.customerType
            ) === "wholesale"
          ? "wholesale"
          : "all",

    firstOrderOnly:
      booleanValue(
        data.firstOrderOnly
      ),

    sellerId:
      stringValue(
        data.sellerId
      ),

    categoryId:
      stringValue(
        data.categoryId
      ),

    productId:
      stringValue(
        data.productId
      ),

    startsAt,

    expiresAt,

    status: calculateStatus(
      status,
      startsAt,
      expiresAt
    ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export default function AdminCouponsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [coupons, setCoupons] =
    useState<Coupon[]>([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<
      "all" | CouponStatus
    >("all");

  const [customerFilter, setCustomerFilter] =
    useState<
      "all" | CustomerType
    >("all");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [processing, setProcessing] =
    useState<string | null>(null);

  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<FormState>(
      EMPTY_FORM
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/coupons";

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

            if (!snapshot.exists()) {
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

            await loadCoupons();
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

  async function loadCoupons() {
    try {
      const snapshot =
        await getDocs(
          collection(
            db,
            "coupons"
          )
        );

      const list: Coupon[] =
        snapshot.docs
          .map((item) =>
            mapCoupon(
              item.id,
              item.data() as Record<
                string,
                unknown
              >
            )
          )
          .sort(
            (a, b) =>
              timestampValue(
                b.createdAt
              ) -
              timestampValue(
                a.createdAt
              )
          );

      setCoupons(list);
    } catch (err) {
      console.error(
        "Coupons load error:",
        err
      );

      setError(
        "Coupons load nahi ho paaye."
      );
    }
  }

  function openCreate() {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(
    coupon: Coupon
  ) {
    setEditingId(coupon.id);

    setForm({
      code: coupon.code,

      title: coupon.title,

      description:
        coupon.description,

      discountType:
        coupon.discountType,

      discountValue:
        String(
          coupon.discountValue
        ),

      maxDiscount:
        coupon.maxDiscount > 0
          ? String(
              coupon.maxDiscount
            )
          : "",

      minOrderValue:
        String(
          coupon.minOrderValue
        ),

      usageLimit:
        String(
          coupon.usageLimit
        ),

      perCustomerLimit:
        String(
          coupon.perCustomerLimit
        ),

      customerType:
        coupon.customerType,

      firstOrderOnly:
        coupon.firstOrderOnly,

      sellerId:
        coupon.sellerId,

      categoryId:
        coupon.categoryId,

      productId:
        coupon.productId,

      startsAt:
        toDateTimeLocal(
          coupon.startsAt
        ),

      expiresAt:
        toDateTimeLocal(
          coupon.expiresAt
        ),

      status:
        coupon.status ===
        "expired"
          ? "active"
          : coupon.status,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function updateField<
    K extends keyof FormState
  >(
    field: K,
    value: FormState[K]
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  async function saveCoupon(
    event: React.FormEvent
  ) {
    event.preventDefault();

    const code =
      form.code
        .trim()
        .toUpperCase();

    const title =
      form.title.trim();

    const discountValue =
      numberValue(
        form.discountValue
      );

    const maxDiscount =
      numberValue(
        form.maxDiscount
      );

    const minOrderValue =
      numberValue(
        form.minOrderValue
      );

    const usageLimit =
      numberValue(
        form.usageLimit
      );

    const perCustomerLimit =
      numberValue(
        form.perCustomerLimit
      ) || 1;

    if (!code) {
      setError(
        "Coupon code required hai."
      );

      return;
    }

    if (
      !/^[A-Z0-9_-]{3,30}$/.test(
        code
      )
    ) {
      setError(
        "Coupon code 3–30 characters ka ho aur sirf A-Z, 0-9, _ ya - use kare."
      );

      return;
    }

    if (!title) {
      setError(
        "Coupon title required hai."
      );

      return;
    }

    if (
      discountValue <= 0
    ) {
      setError(
        "Discount value 0 se greater honi chahiye."
      );

      return;
    }

    if (
      form.discountType ===
        "percentage" &&
      discountValue > 100
    ) {
      setError(
        "Percentage discount 100 se zyada nahi ho sakta."
      );

      return;
    }

    if (
      minOrderValue < 0 ||
      maxDiscount < 0
    ) {
      setError(
        "Price values invalid hain."
      );

      return;
    }

    if (
      usageLimit < 0 ||
      perCustomerLimit < 1
    ) {
      setError(
        "Usage limits invalid hain."
      );

      return;
    }

    if (
      form.startsAt &&
      form.expiresAt &&
      new Date(
        form.startsAt
      ).getTime() >=
        new Date(
          form.expiresAt
        ).getTime()
    ) {
      setError(
        "Expiry date start date ke baad honi chahiye."
      );

      return;
    }

    try {
      setProcessing(
        editingId ?? "new"
      );

      setError("");
      setSuccess("");

      const payload = {
        code,

        title,

        description:
          form.description.trim(),

        discountType:
          form.discountType,

        discountValue,

        maxDiscount,

        minOrderValue,

        usageLimit,

        perCustomerLimit,

        customerType:
          form.customerType,

        firstOrderOnly:
          form.firstOrderOnly,

        sellerId:
          form.sellerId.trim(),

        categoryId:
          form.categoryId.trim(),

        productId:
          form.productId.trim(),

        startsAt:
          form.startsAt
            ? new Date(
                form.startsAt
              )
            : null,

        expiresAt:
          form.expiresAt
            ? new Date(
                form.expiresAt
              )
            : null,

        status:
          form.status,

        updatedAt:
          serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(
            db,
            "coupons",
            editingId
          ),
          payload
        );

        setSuccess(
          "Coupon successfully updated."
        );
      } else {
        await addDoc(
          collection(
            db,
            "coupons"
          ),
          {
            ...payload,

            usedCount: 0,

            createdAt:
              serverTimestamp(),
          }
        );

        setSuccess(
          "Coupon successfully created."
        );
      }

      setShowForm(false);

      setEditingId(null);

      setForm({
        ...EMPTY_FORM,
      });

      await loadCoupons();
    } catch (err) {
      console.error(
        "Save coupon error:",
        err
      );

      setError(
        "Coupon save nahi ho saka."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function toggleCoupon(
    coupon: Coupon
  ) {
    const nextStatus =
      coupon.status ===
      "disabled"
        ? "active"
        : "disabled";

    const confirmed =
      window.confirm(
        nextStatus ===
          "disabled"
          ? `"${coupon.code}" ko disable karna hai?`
          : `"${coupon.code}" ko enable karna hai?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessing(
        coupon.id
      );

      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "coupons",
          coupon.id
        ),
        {
          status:
            nextStatus,

          updatedAt:
            serverTimestamp(),
        }
      );

      await loadCoupons();

      setSuccess(
        nextStatus ===
          "disabled"
          ? "Coupon disabled."
          : "Coupon enabled."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Coupon status update nahi ho saka."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function removeCoupon(
    coupon: Coupon
  ) {
    const confirmed =
      window.confirm(
        `"${coupon.code}" ko permanently delete karna hai?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessing(
        coupon.id
      );

      setError("");
      setSuccess("");

      await deleteDoc(
        doc(
          db,
          "coupons",
          coupon.id
        )
      );

      await loadCoupons();

      setSuccess(
        "Coupon deleted."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Coupon delete nahi ho saka."
      );
    } finally {
      setProcessing(null);
    }
  }

  const filteredCoupons =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return coupons.filter(
        (coupon) => {
          const matchesSearch =
            !query ||
            [
              coupon.code,
              coupon.title,
              coupon.description,
              coupon.sellerId,
              coupon.categoryId,
              coupon.productId,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            statusFilter ===
              "all" ||
            coupon.status ===
              statusFilter;

          const matchesCustomer =
            customerFilter ===
              "all" ||
            coupon.customerType ===
              customerFilter ||
            coupon.customerType ===
              "all";

          return (
            matchesSearch &&
            matchesStatus &&
            matchesCustomer
          );
        }
      );
    }, [
      coupons,
      search,
      statusFilter,
      customerFilter,
    ]);

  const activeCount =
    coupons.filter(
      (coupon) =>
        coupon.status ===
        "active"
    ).length;

  const scheduledCount =
    coupons.filter(
      (coupon) =>
        coupon.status ===
        "scheduled"
    ).length;

  const expiredCount =
    coupons.filter(
      (coupon) =>
        coupon.status ===
        "expired"
    ).length;

  const disabledCount =
    coupons.filter(
      (coupon) =>
        coupon.status ===
        "disabled"
    ).length;

  const totalUses =
    coupons.reduce(
      (sum, coupon) =>
        sum + coupon.usedCount,
      0
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading Coupon Management...
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
              href="/admin/wholesale"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Wholesale
            </Link>

            <button
              type="button"
              onClick={() => {
                loadCoupons();
              }}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              ↻ Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-black text-white"
            >
              + Create Coupon
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
          ADMIN / COUPONS & PROMOTIONS
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Coupons & Promotions
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Discount codes, customer targeting,
              usage limits aur promotional offers
              manage karein.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-black px-5 py-3 text-sm font-black text-white"
          >
            + New Coupon
          </button>
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

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total"
            value={
              coupons.length
            }
          />

          <StatCard
            label="Active"
            value={activeCount}
          />

          <StatCard
            label="Scheduled"
            value={scheduledCount}
          />

          <StatCard
            label="Expired"
            value={expiredCount}
          />

          <StatCard
            label="Disabled"
            value={disabledCount}
          />

          <StatCard
            label="Total Uses"
            value={totalUses}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto_auto]">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search coupon code, title, seller, category..."
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as
                  | "all"
                  | CouponStatus
              )
            }
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none"
          >
            <option value="all">
              All Status
            </option>

            <option value="active">
              Active
            </option>

            <option value="scheduled">
              Scheduled
            </option>

            <option value="expired">
              Expired
            </option>

            <option value="disabled">
              Disabled
            </option>
          </select>

          <select
            value={customerFilter}
            onChange={(event) =>
              setCustomerFilter(
                event.target
                  .value as
                  | "all"
                  | CustomerType
              )
            }
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none"
          >
            <option value="all">
              All Customers
            </option>

            <option value="retail">
              Retail
            </option>

            <option value="wholesale">
              Wholesale
            </option>
          </select>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">
          {filteredCoupons.length ===
          0 ? (
            <EmptyState
              icon="🎟️"
              title="No coupons found"
              text="Search/filter change karein ya naya coupon create karein."
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredCoupons.map(
                (coupon) => (
                  <CouponRow
                    key={coupon.id}
                    coupon={coupon}
                    processing={
                      processing ===
                      coupon.id
                    }
                    onEdit={() =>
                      openEdit(
                        coupon
                      )
                    }
                    onToggle={() =>
                      toggleCoupon(
                        coupon
                      )
                    }
                    onDelete={() =>
                      removeCoupon(
                        coupon
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </div>

        {showForm && (
          <CouponModal
            editingId={
              editingId
            }
            form={form}
            processing={
              processing ===
              (editingId ??
                "new")
            }
            onChange={
              updateField
            }
            onClose={() => {
              if (!processing) {
                setShowForm(
                  false
                );

                setEditingId(
                  null
                );
              }
            }}
            onSubmit={
              saveCoupon
            }
          />
        )}

        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-black uppercase tracking-widest text-amber-700">
            Production Security
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            Coupon validation aur final discount
            calculation checkout ke trusted backend
            par enforce karna chahiye. Client-side
            coupon data ko final authority nahi maana
            jayega.
          </p>
        </div>
      </div>
    </main>
  );
}

function CouponModal({
  editingId,
  form,
  processing,
  onChange,
  onClose,
  onSubmit,
}: {
  editingId: string | null;
  form: FormState;
  processing: boolean;
  onChange: <
    K extends keyof FormState
  >(
    field: K,
    value: FormState[K]
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: React.FormEvent
  ) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto my-6 max-w-4xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              ANJIVO PROMOTION
            </p>

            <h2 className="mt-1 text-xl font-black">
              {editingId
                ? "Edit Coupon"
                : "Create Coupon"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="rounded-xl border px-3 py-2 text-sm font-black disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-7 p-5 sm:p-6"
        >
          <section>
            <SectionTitle
              title="Basic Information"
              text="Coupon ki basic identity aur customer-facing information."
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Coupon Code *"
                value={form.code}
                onChange={(value) =>
                  onChange(
                    "code",
                    value.toUpperCase()
                  )
                }
                placeholder="SAVE10"
              />

              <Field
                label="Coupon Title *"
                value={form.title}
                onChange={(value) =>
                  onChange(
                    "title",
                    value
                  )
                }
                placeholder="10% Off"
              />

              <div className="sm:col-span-2">
                <label className="text-xs font-black text-gray-600">
                  Description
                </label>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(
                    event
                  ) =>
                    onChange(
                      "description",
                      event.target
                        .value
                    )
                  }
                  rows={3}
                  placeholder="Short coupon description..."
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle
              title="Discount Rules"
              text="Percentage ya fixed rupee discount configure karein."
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="Discount Type"
                value={
                  form.discountType
                }
                onChange={(value) =>
                  onChange(
                    "discountType",
                    value as DiscountType
                  )
                }
                options={[
                  [
                    "percentage",
                    "Percentage",
                  ],
                  [
                    "fixed",
                    "Fixed ₹",
                  ],
                ]}
              />

              <NumberField
                label={
                  form.discountType ===
                  "percentage"
                    ? "Discount % *"
                    : "Discount ₹ *"
                }
                value={
                  form.discountValue
                }
                onChange={(value) =>
                  onChange(
                    "discountValue",
                    value
                  )
                }
              />

              <NumberField
                label="Maximum Discount ₹"
                value={
                  form.maxDiscount
                }
                onChange={(value) =>
                  onChange(
                    "maxDiscount",
                    value
                  )
                }
              />

              <NumberField
                label="Minimum Order ₹"
                value={
                  form.minOrderValue
                }
                onChange={(value) =>
                  onChange(
                    "minOrderValue",
                    value
                  )
                }
              />
            </div>
          </section>

          <section>
            <SectionTitle
              title="Usage & Customer Rules"
              text="Coupon kitni baar aur kis customer ke liye available hoga."
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField
                label="Total Usage Limit"
                value={
                  form.usageLimit
                }
                hint="0 = unlimited"
                onChange={(value) =>
                  onChange(
                    "usageLimit",
                    value
                  )
                }
              />

              <NumberField
                label="Per Customer Limit"
                value={
                  form.perCustomerLimit
                }
                onChange={(value) =>
                  onChange(
                    "perCustomerLimit",
                    value
                  )
                }
              />

              <SelectField
                label="Customer Type"
                value={
                  form.customerType
                }
                onChange={(value) =>
                  onChange(
                    "customerType",
                    value as CustomerType
                  )
                }
                options={[
                  [
                    "all",
                    "All Customers",
                  ],
                  [
                    "retail",
                    "Retail Only",
                  ],
                  [
                    "wholesale",
                    "Wholesale Only",
                  ],
                ]}
              />

              <SelectField
                label="Status"
                value={
                  form.status
                }
                onChange={(value) =>
                  onChange(
                    "status",
                    value as CouponStatus
                  )
                }
                options={[
                  [
                    "active",
                    "Active",
                  ],
                  [
                    "scheduled",
                    "Scheduled",
                  ],
                  [
                    "disabled",
                    "Disabled",
                  ],
                ]}
              />
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={
                  form.firstOrderOnly
                }
                onChange={(event) =>
                  onChange(
                    "firstOrderOnly",
                    event.target
                      .checked
                  )
                }
                className="h-4 w-4"
              />

              <span>
                <span className="block text-sm font-black">
                  First Order Only
                </span>

                <span className="block text-xs text-gray-500">
                  Sirf new customers ke first order par coupon apply hoga.
                </span>
              </span>
            </label>
          </section>

          <section>
            <SectionTitle
              title="Targeting"
              text="Optional seller, category ya product specific coupon."
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field
                label="Seller ID"
                value={
                  form.sellerId
                }
                onChange={(value) =>
                  onChange(
                    "sellerId",
                    value
                  )
                }
                placeholder="Optional"
              />

              <Field
                label="Category ID"
                value={
                  form.categoryId
                }
                onChange={(value) =>
                  onChange(
                    "categoryId",
                    value
                  )
                }
                placeholder="Optional"
              />

              <Field
                label="Product ID"
                value={
                  form.productId
                }
                onChange={(value) =>
                  onChange(
                    "productId",
                    value
                  )
                }
                placeholder="Optional"
              />
            </div>
          </section>

          <section>
            <SectionTitle
              title="Schedule"
              text="Coupon ko future date par start aur expiry date par automatically expire kar sakte hain."
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DateField
                label="Starts At"
                value={
                  form.startsAt
                }
                onChange={(value) =>
                  onChange(
                    "startsAt",
                    value
                  )
                }
              />

              <DateField
                label="Expires At"
                value={
                  form.expiresAt
                }
                onChange={(value) =>
                  onChange(
                    "expiresAt",
                    value
                  )
                }
              />
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-black disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={processing}
              className="rounded-xl bg-black px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {processing
                ? "Saving..."
                : editingId
                  ? "Update Coupon"
                  : "Create Coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CouponRow({
  coupon,
  processing,
  onEdit,
  onToggle,
  onDelete,
}: {
  coupon: Coupon;
  processing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const usagePercent =
    coupon.usageLimit > 0
      ? Math.min(
          100,
          Math.round(
            (coupon.usedCount /
              coupon.usageLimit) *
              100
          )
        )
      : 0;

  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-black px-3 py-2 font-mono text-sm font-black tracking-wider text-white">
              {coupon.code}
            </span>

            <StatusBadge
              status={
                coupon.status
              }
            />

            {coupon.firstOrderOnly && (
              <span className="rounded-full bg-blue-100 px-3 py-1.5 text-[9px] font-black text-blue-700">
                FIRST ORDER
              </span>
            )}
          </div>

          <h3 className="mt-3 text-base font-black">
            {coupon.title ||
              "Untitled Coupon"}
          </h3>

          {coupon.description && (
            <p className="mt-1 max-w-2xl text-xs text-gray-500">
              {
                coupon.description
              }
            </p>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              label="Discount"
              value={
                coupon.discountType ===
                "percentage"
                  ? `${coupon.discountValue}%`
                  : `₹${coupon.discountValue.toLocaleString(
                      "en-IN"
                    )}`
              }
            />

            <InfoCard
              label="Min Order"
              value={`₹${coupon.minOrderValue.toLocaleString(
                "en-IN"
              )}`}
            />

            <InfoCard
              label="Customer"
              value={
                coupon.customerType ===
                "all"
                  ? "All"
                  : coupon.customerType ===
                      "retail"
                    ? "Retail"
                    : "Wholesale"
              }
            />

            <InfoCard
              label="Usage"
              value={
                coupon.usageLimit >
                0
                  ? `${coupon.usedCount}/${coupon.usageLimit}`
                  : `${coupon.usedCount}/∞`
              }
            />
          </div>

          {coupon.usageLimit >
            0 && (
            <div className="mt-4 max-w-md">
              <div className="flex justify-between text-[10px] font-bold text-gray-500">
                <span>
                  Usage
                </span>

                <span>
                  {usagePercent}%
                </span>
              </div>

              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-black"
                  style={{
                    width: `${usagePercent}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {coupon.sellerId && (
              <InfoBadge>
                Seller:{" "}
                {coupon.sellerId}
              </InfoBadge>
            )}

            {coupon.categoryId && (
              <InfoBadge>
                Category:{" "}
                {coupon.categoryId}
              </InfoBadge>
            )}

            {coupon.productId && (
              <InfoBadge>
                Product:{" "}
                {coupon.productId}
              </InfoBadge>
            )}

            <InfoBadge>
              Per Customer:{" "}
              {
                coupon.perCustomerLimit
              }
            </InfoBadge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:w-48 xl:justify-end">
          <button
            type="button"
            onClick={onEdit}
            disabled={processing}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black hover:border-black disabled:opacity-50"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onToggle}
            disabled={processing}
            className={`rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50 ${
              coupon.status ===
              "disabled"
                ? "bg-black"
                : "bg-red-600"
            }`}
          >
            {processing
              ? "..."
              : coupon.status ===
                  "disabled"
                ? "Enable"
                : "Disable"}
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={processing}
            className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: CouponStatus;
}) {
  const styles: Record<
    CouponStatus,
    string
  > = {
    active:
      "bg-green-100 text-green-700",

    scheduled:
      "bg-blue-100 text-blue-700",

    expired:
      "bg-gray-100 text-gray-600",

    disabled:
      "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${styles[status]}`}
    >
      {status.toUpperCase()}
    </span>
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
  onChange: (
    value: string
  ) => void;
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
        placeholder={
          placeholder
        }
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-black text-gray-600">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-black text-gray-600">
        {label}
      </label>

      {hint && (
        <span className="ml-2 text-[10px] text-gray-400">
          {hint}
        </span>
      )}

      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <label className="text-xs font-black text-gray-600">
        {label}
      </label>

      <input
        type="datetime-local"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  options: [
    string,
    string
  ][];
}) {
  return (
    <div>
      <label className="text-xs font-black text-gray-600">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-black"
      >
        {options.map(
          ([
            optionValue,
            labelText,
          ]) => (
            <option
              key={
                optionValue
              }
              value={
                optionValue
              }
            >
              {
                labelText
              }
            </option>
          )
        )}
      </select>
    </div>
  );
}

function SectionTitle({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-black">
        {title}
      </h3>

      <p className="mt-1 text-xs text-gray-500">
        {text}
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-xs font-black">
        {value}
      </p>
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
