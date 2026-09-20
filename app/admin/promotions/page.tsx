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

type PromotionType = "percentage" | "fixed" | "flash_sale";

type PromotionStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "expired"
  | "paused";

type TargetType = "all" | "retail" | "wholesale";

type Promotion = {
  id: string;
  name: string;
  description: string;
  type: PromotionType;
  discountValue: number;
  maxDiscount: number;
  minOrderValue: number;

  targetType: TargetType;

  categoryId: string;
  categoryName: string;

  productId: string;
  productName: string;

  sellerId: string;
  sellerName: string;

  bannerImage: string;
  bannerTitle: string;
  bannerSubtitle: string;

  startsAt?: unknown;
  endsAt?: unknown;

  status: PromotionStatus;

  featured: boolean;
  homepage: boolean;

  usageLimit: number;
  usedCount: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type FormState = {
  name: string;
  description: string;

  type: PromotionType;
  discountValue: string;
  maxDiscount: string;
  minOrderValue: string;

  targetType: TargetType;

  categoryId: string;
  categoryName: string;

  productId: string;
  productName: string;

  sellerId: string;
  sellerName: string;

  bannerImage: string;
  bannerTitle: string;
  bannerSubtitle: string;

  startsAt: string;
  endsAt: string;

  featured: boolean;
  homepage: boolean;

  usageLimit: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",

  type: "percentage",
  discountValue: "",
  maxDiscount: "",
  minOrderValue: "0",

  targetType: "all",

  categoryId: "",
  categoryName: "",

  productId: "",
  productName: "",

  sellerId: "",
  sellerName: "",

  bannerImage: "",
  bannerTitle: "",
  bannerSubtitle: "",

  startsAt: "",
  endsAt: "",

  featured: false,
  homepage: false,

  usageLimit: "0",
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  return 0;
}

function toDateTimeLocal(value: unknown): string {
  const millis = timestampValue(value);

  if (!millis) return "";

  const date = new Date(millis);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function calculateStatus(
  startsAt: unknown,
  endsAt: unknown,
  storedStatus: PromotionStatus
): PromotionStatus {
  if (storedStatus === "paused" || storedStatus === "draft") {
    return storedStatus;
  }

  const now = Date.now();
  const start = timestampValue(startsAt);
  const end = timestampValue(endsAt);

  if (start && now < start) return "scheduled";

  if (end && now > end) return "expired";

  return "active";
}

function mapPromotion(
  id: string,
  data: Record<string, unknown>
): Promotion {
  const storedStatus =
    data.status === "draft" ||
    data.status === "scheduled" ||
    data.status === "active" ||
    data.status === "expired" ||
    data.status === "paused"
      ? data.status
      : "draft";

  return {
    id,

    name: stringValue(data.name),
    description: stringValue(data.description),

    type:
      data.type === "fixed" || data.type === "flash_sale"
        ? data.type
        : "percentage",

    discountValue: numberValue(data.discountValue),
    maxDiscount: numberValue(data.maxDiscount),
    minOrderValue: numberValue(data.minOrderValue),

    targetType:
      data.targetType === "retail" || data.targetType === "wholesale"
        ? data.targetType
        : "all",

    categoryId: stringValue(data.categoryId),
    categoryName: stringValue(data.categoryName),

    productId: stringValue(data.productId),
    productName: stringValue(data.productName),

    sellerId: stringValue(data.sellerId),
    sellerName: stringValue(data.sellerName),

    bannerImage: stringValue(data.bannerImage),
    bannerTitle: stringValue(data.bannerTitle),
    bannerSubtitle: stringValue(data.bannerSubtitle),

    startsAt: data.startsAt,
    endsAt: data.endsAt,

    status: calculateStatus(
      data.startsAt,
      data.endsAt,
      storedStatus
    ),

    featured: booleanValue(data.featured),
    homepage: booleanValue(data.homepage),

    usageLimit: numberValue(data.usageLimit),
    usedCount: numberValue(data.usedCount),

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function formatDate(value: unknown): string {
  const millis = timestampValue(value);

  if (!millis) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(millis));
}

function getDiscountLabel(promotion: Promotion): string {
  if (promotion.type === "percentage") {
    return `${promotion.discountValue}% OFF`;
  }

  if (promotion.type === "fixed") {
    return `₹${promotion.discountValue.toLocaleString("en-IN")} OFF`;
  }

  if (promotion.type === "flash_sale") {
    return `${promotion.discountValue}% FLASH SALE`;
  }

  return "Promotion";
}

function createStatusFromDates(
  startsAt: string,
  endsAt: string,
  fallback: PromotionStatus = "active"
): PromotionStatus {
  if (fallback === "draft" || fallback === "paused") {
    return fallback;
  }

  const start = startsAt ? new Date(startsAt).getTime() : 0;
  const end = endsAt ? new Date(endsAt).getTime() : 0;
  const now = Date.now();

  if (start && now < start) return "scheduled";
  if (end && now > end) return "expired";

  return "active";
}

export default function AdminPromotionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [authorized, setAuthorized] = useState(false);

  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | PromotionStatus
  >("all");

  const [targetFilter, setTargetFilter] = useState<
    "all" | TargetType
  >("all");

  const [typeFilter, setTypeFilter] = useState<
    "all" | PromotionType
  >("all");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href =
          "/login?redirect=/admin/promotions";
        return;
      }

      try {
        const userSnap = await getDoc(
          doc(db, "users", user.uid)
        );

        if (!userSnap.exists()) {
          window.location.href = "/";
          return;
        }

        const userData = userSnap.data();

        if (userData.role !== "ADMIN") {
          window.location.href = "/account";
          return;
        }

        setAuthorized(true);
        await loadPromotions();
      } catch (error) {
        console.error("Admin authorization error:", error);
        window.location.href = "/";
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function loadPromotions() {
    try {
      const snapshot = await getDocs(
        collection(db, "promotions")
      );

      const list = snapshot.docs.map((item) =>
        mapPromotion(item.id, item.data())
      );

      list.sort(
        (a, b) =>
          timestampValue(b.createdAt) -
          timestampValue(a.createdAt)
      );

      setPromotions(list);
    } catch (error) {
      console.error("Load promotions error:", error);
      alert(
        "Promotions load nahi ho paaye. Firestore rules check karein."
      );
    }
  }

  const filteredPromotions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return promotions.filter((promotion) => {
      const matchesSearch =
        !query ||
        promotion.name.toLowerCase().includes(query) ||
        promotion.description.toLowerCase().includes(query) ||
        promotion.categoryName.toLowerCase().includes(query) ||
        promotion.productName.toLowerCase().includes(query) ||
        promotion.sellerName.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        promotion.status === statusFilter;

      const matchesTarget =
        targetFilter === "all" ||
        promotion.targetType === targetFilter;

      const matchesType =
        typeFilter === "all" ||
        promotion.type === typeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesTarget &&
        matchesType
      );
    });
  }, [
    promotions,
    search,
    statusFilter,
    targetFilter,
    typeFilter,
  ]);

  const stats = useMemo(() => {
    const total = promotions.length;

    const active = promotions.filter(
      (item) => item.status === "active"
    ).length;

    const scheduled = promotions.filter(
      (item) => item.status === "scheduled"
    ).length;

    const expired = promotions.filter(
      (item) => item.status === "expired"
    ).length;

    const paused = promotions.filter(
      (item) => item.status === "paused"
    ).length;

    const featured = promotions.filter(
      (item) => item.featured
    ).length;

    const homepage = promotions.filter(
      (item) => item.homepage
    ).length;

    const totalUsage = promotions.reduce(
      (sum, item) => sum + item.usedCount,
      0
    );

    return {
      total,
      active,
      scheduled,
      expired,
      paused,
      featured,
      homepage,
      totalUsage,
    };
  }, [promotions]);

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(promotion: Promotion) {
    setEditingId(promotion.id);

    setForm({
      name: promotion.name,
      description: promotion.description,

      type: promotion.type,
      discountValue: String(promotion.discountValue || ""),
      maxDiscount: String(promotion.maxDiscount || ""),
      minOrderValue: String(promotion.minOrderValue || 0),

      targetType: promotion.targetType,

      categoryId: promotion.categoryId,
      categoryName: promotion.categoryName,

      productId: promotion.productId,
      productName: promotion.productName,

      sellerId: promotion.sellerId,
      sellerName: promotion.sellerName,

      bannerImage: promotion.bannerImage,
      bannerTitle: promotion.bannerTitle,
      bannerSubtitle: promotion.bannerSubtitle,

      startsAt: toDateTimeLocal(promotion.startsAt),
      endsAt: toDateTimeLocal(promotion.endsAt),

      featured: promotion.featured,
      homepage: promotion.homepage,

      usageLimit: String(promotion.usageLimit || 0),
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function savePromotion() {
    const name = form.name.trim();
    const description = form.description.trim();

    const discountValue = Number(form.discountValue);
    const maxDiscount = Number(form.maxDiscount || 0);
    const minOrderValue = Number(form.minOrderValue || 0);
    const usageLimit = Number(form.usageLimit || 0);

    if (!name) {
      alert("Promotion name required hai.");
      return;
    }

    if (
      !Number.isFinite(discountValue) ||
      discountValue <= 0
    ) {
      alert("Valid discount value enter karein.");
      return;
    }

    if (
      (form.type === "percentage" ||
        form.type === "flash_sale") &&
      discountValue > 100
    ) {
      alert("Percentage discount 100% se zyada nahi ho sakta.");
      return;
    }

    if (
      !Number.isFinite(maxDiscount) ||
      maxDiscount < 0
    ) {
      alert("Valid maximum discount enter karein.");
      return;
    }

    if (
      !Number.isFinite(minOrderValue) ||
      minOrderValue < 0
    ) {
      alert("Valid minimum order value enter karein.");
      return;
    }

    if (
      !Number.isFinite(usageLimit) ||
      usageLimit < 0
    ) {
      alert("Valid usage limit enter karein.");
      return;
    }

    if (form.startsAt && form.endsAt) {
      const start = new Date(form.startsAt).getTime();
      const end = new Date(form.endsAt).getTime();

      if (start >= end) {
        alert(
          "Promotion start date end date se pehle honi chahiye."
        );
        return;
      }
    }

    if (form.homepage && !form.bannerTitle.trim()) {
      alert(
        "Homepage promotion ke liye Banner Title required hai."
      );
      return;
    }

    setSaving(true);

    try {
      const status = createStatusFromDates(
        form.startsAt,
        form.endsAt,
        "active"
      );

      const payload = {
        name,
        description,

        type: form.type,
        discountValue,
        maxDiscount,
        minOrderValue,

        targetType: form.targetType,

        categoryId: form.categoryId.trim(),
        categoryName: form.categoryName.trim(),

        productId: form.productId.trim(),
        productName: form.productName.trim(),

        sellerId: form.sellerId.trim(),
        sellerName: form.sellerName.trim(),

        bannerImage: form.bannerImage.trim(),
        bannerTitle: form.bannerTitle.trim(),
        bannerSubtitle: form.bannerSubtitle.trim(),

        startsAt: form.startsAt
          ? new Date(form.startsAt)
          : null,

        endsAt: form.endsAt
          ? new Date(form.endsAt)
          : null,

        featured: form.featured,
        homepage: form.homepage,

        usageLimit,

        ...(editingId
          ? {}
          : {
              usedCount: 0,
            }),

        status,

        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, "promotions", editingId),
          payload
        );
      } else {
        await addDoc(collection(db, "promotions"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      await loadPromotions();

      closeModal();

      alert(
        editingId
          ? "Promotion successfully updated."
          : "Promotion successfully created."
      );
    } catch (error) {
      console.error("Save promotion error:", error);
      alert(
        "Promotion save nahi ho paayi. Firestore rules aur data check karein."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePromotion(promotion: Promotion) {
    try {
      const nextStatus =
        promotion.status === "active"
          ? "paused"
          : "active";

      await updateDoc(
        doc(db, "promotions", promotion.id),
        {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        }
      );

      await loadPromotions();
    } catch (error) {
      console.error("Toggle promotion error:", error);
      alert("Promotion status update nahi ho saka.");
    }
  }

  async function archivePromotion(promotion: Promotion) {
    const confirmed = window.confirm(
      `Kya aap "${promotion.name}" ko delete karna chahte hain?`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(
        doc(db, "promotions", promotion.id)
      );

      await loadPromotions();
    } catch (error) {
      console.error("Delete promotion error:", error);
      alert("Promotion delete nahi ho paayi.");
    }
  }

  async function toggleFeatured(promotion: Promotion) {
    try {
      await updateDoc(
        doc(db, "promotions", promotion.id),
        {
          featured: !promotion.featured,
          updatedAt: serverTimestamp(),
        }
      );

      await loadPromotions();
    } catch (error) {
      console.error("Featured update error:", error);
      alert("Featured status update nahi ho saka.");
    }
  }

  async function toggleHomepage(promotion: Promotion) {
    try {
      await updateDoc(
        doc(db, "promotions", promotion.id),
        {
          homepage: !promotion.homepage,
          updatedAt: serverTimestamp(),
        }
      );

      await loadPromotions();
    } catch (error) {
      console.error("Homepage update error:", error);
      alert("Homepage status update nahi ho saka.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="mt-4 text-sm text-slate-600">
            Loading promotions...
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
            <Link href="/admin" className="shrink-0">
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
                Promotions
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Admin Home
            </Link>

            <button
              onClick={openCreateModal}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              + Create Promotion
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-indigo-600">
            Marketing & Growth
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Promotions Management
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            ANJIVO par sales campaigns, flash sales, category
            promotions aur homepage promotional campaigns manage karein.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Promotions"
            value={stats.total}
            icon="🎯"
          />

          <StatCard
            label="Active"
            value={stats.active}
            icon="🔥"
          />

          <StatCard
            label="Scheduled"
            value={stats.scheduled}
            icon="📅"
          />

          <StatCard
            label="Total Usage"
            value={stats.totalUsage}
            icon="📊"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Expired"
            value={stats.expired}
            icon="⏰"
          />

          <StatCard
            label="Paused"
            value={stats.paused}
            icon="⏸️"
          />

          <StatCard
            label="Featured"
            value={stats.featured}
            icon="⭐"
          />

          <StatCard
            label="Homepage"
            value={stats.homepage}
            icon="🏠"
          />
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_auto]">
              <SearchBox
                value={search}
                onChange={setSearch}
              />

              <SelectBox
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(
                    value as "all" | PromotionStatus
                  )
                }
                options={[
                  ["all", "All Status"],
                  ["active", "Active"],
                  ["scheduled", "Scheduled"],
                  ["paused", "Paused"],
                  ["expired", "Expired"],
                  ["draft", "Draft"],
                ]}
              />

              <SelectBox
                value={typeFilter}
                onChange={(value) =>
                  setTypeFilter(
                    value as "all" | PromotionType
                  )
                }
                options={[
                  ["all", "All Types"],
                  ["percentage", "Percentage"],
                  ["fixed", "Fixed"],
                  ["flash_sale", "Flash Sale"],
                ]}
              />

              <SelectBox
                value={targetFilter}
                onChange={(value) =>
                  setTargetFilter(
                    value as "all" | TargetType
                  )
                }
                options={[
                  ["all", "All Customers"],
                  ["retail", "Retail"],
                  ["wholesale", "Wholesale"],
                ]}
              />

              <button
                onClick={loadPromotions}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {filteredPromotions.length === 0 ? (
            <EmptyState
              title="No promotions found"
              description={
                promotions.length === 0
                  ? "Abhi koi promotion create nahi hua hai."
                  : "Aapke current filters ke according koi promotion nahi mila."
              }
              action={
                promotions.length === 0
                  ? {
                      label: "Create Promotion",
                      onClick: openCreateModal,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPromotions.map((promotion) => (
                <PromotionRow
                  key={promotion.id}
                  promotion={promotion}
                  onEdit={() =>
                    openEditModal(promotion)
                  }
                  onToggle={() =>
                    togglePromotion(promotion)
                  }
                  onDelete={() =>
                    archivePromotion(promotion)
                  }
                  onFeatured={() =>
                    toggleFeatured(promotion)
                  }
                  onHomepage={() =>
                    toggleHomepage(promotion)
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <PromotionModal
          form={form}
          setForm={setForm}
          editing={Boolean(editingId)}
          saving={saving}
          onClose={closeModal}
          onSave={savePromotion}
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
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        🔎
      </span>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder="Search promotion, product, category, seller..."
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
    >
      {options.map(([optionValue, label]) => (
        <option
          key={optionValue}
          value={optionValue}
        >
          {label}
        </option>
      ))}
    </select>
  );
}

function PromotionRow({
  promotion,
  onEdit,
  onToggle,
  onDelete,
  onFeatured,
  onHomepage,
}: {
  promotion: Promotion;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onFeatured: () => void;
  onHomepage: () => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl sm:flex">
            {promotion.type === "flash_sale"
              ? "⚡"
              : promotion.type === "percentage"
              ? "％"
              : "₹"}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-slate-900">
                {promotion.name || "Untitled Promotion"}
              </h3>

              <StatusBadge status={promotion.status} />
            </div>

            <p className="mt-1 text-sm font-semibold text-indigo-600">
              {getDiscountLabel(promotion)}
            </p>

            {promotion.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                {promotion.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <InfoBadge
                label={
                  promotion.targetType === "all"
                    ? "All Customers"
                    : promotion.targetType === "retail"
                    ? "Retail"
                    : "Wholesale"
                }
              />

              {promotion.minOrderValue > 0 && (
                <InfoBadge
                  label={`Min ₹${promotion.minOrderValue.toLocaleString(
                    "en-IN"
                  )}`}
                />
              )}

              {promotion.categoryName && (
                <InfoBadge
                  label={`Category: ${promotion.categoryName}`}
                />
              )}

              {promotion.productName && (
                <InfoBadge
                  label={`Product: ${promotion.productName}`}
                />
              )}

              {promotion.sellerName && (
                <InfoBadge
                  label={`Seller: ${promotion.sellerName}`}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[500px] xl:grid-cols-4">
          <MiniInfo
            label="Usage"
            value={
              promotion.usageLimit > 0
                ? `${promotion.usedCount}/${promotion.usageLimit}`
                : `${promotion.usedCount}/∞`
            }
          />

          <MiniInfo
            label="Starts"
            value={formatDate(promotion.startsAt)}
          />

          <MiniInfo
            label="Ends"
            value={formatDate(promotion.endsAt)}
          />

          <MiniInfo
            label="Max Discount"
            value={
              promotion.maxDiscount > 0
                ? `₹${promotion.maxDiscount.toLocaleString(
                    "en-IN"
                  )}`
                : "No limit"
            }
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onFeatured}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              promotion.featured
                ? "bg-amber-100 text-amber-700"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            ⭐ {promotion.featured ? "Featured" : "Feature"}
          </button>

          <button
            onClick={onHomepage}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              promotion.homepage
                ? "bg-indigo-100 text-indigo-700"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            🏠 {promotion.homepage ? "Homepage" : "Add Homepage"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onEdit}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ✏️ Edit
          </button>

          <button
            onClick={onToggle}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              promotion.status === "active"
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            }`}
          >
            {promotion.status === "active"
              ? "⏸ Pause"
              : "▶ Activate"}
          </button>

          <button
            onClick={onDelete}
            className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            🗑 Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: PromotionStatus;
}) {
  const styles: Record<
    PromotionStatus,
    string
  > = {
    draft:
      "bg-slate-100 text-slate-700",
    scheduled:
      "bg-blue-100 text-blue-700",
    active:
      "bg-emerald-100 text-emerald-700",
    expired:
      "bg-red-100 text-red-700",
    paused:
      "bg-amber-100 text-amber-700",
  };

  const labels: Record<
    PromotionStatus,
    string
  > = {
    draft: "Draft",
    scheduled: "Scheduled",
    active: "Active",
    expired: "Expired",
    paused: "Paused",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function InfoBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
      {label}
    </span>
  );
}

function PromotionModal({
  form,
  setForm,
  editing,
  saving,
  onClose,
  onSave,
}: {
  form: FormState;
  setForm: React.Dispatch<
    React.SetStateAction<FormState>
  >;
  editing: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Marketing
            </p>

            <h2 className="text-xl font-bold text-slate-900">
              {editing
                ? "Edit Promotion"
                : "Create Promotion"}
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="space-y-6">
            <SectionTitle
              title="Basic Information"
              description="Campaign ka basic information."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Promotion Name"
                required
                value={form.name}
                onChange={(value) =>
                  update("name", value)
                }
                placeholder="Diwali Mega Sale"
              />

              <SelectField
                label="Promotion Type"
                value={form.type}
                onChange={(value) =>
                  update(
                    "type",
                    value as PromotionType
                  )
                }
                options={[
                  ["percentage", "Percentage Discount"],
                  ["fixed", "Fixed Amount Discount"],
                  ["flash_sale", "Flash Sale"],
                ]}
              />

              <div className="md:col-span-2">
                <Field
                  label="Description"
                  value={form.description}
                  onChange={(value) =>
                    update("description", value)
                  }
                  placeholder="Campaign ke baare mein short description..."
                  textarea
                />
              </div>
            </div>

            <SectionTitle
              title="Discount Rules"
              description="Promotion ka discount structure."
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField
                label={
                  form.type === "fixed"
                    ? "Discount Amount"
                    : "Discount Percentage"
                }
                required
                value={form.discountValue}
                onChange={(value) =>
                  update("discountValue", value)
                }
                placeholder={
                  form.type === "fixed"
                    ? "500"
                    : "20"
                }
                suffix={
                  form.type === "fixed" ? "₹" : "%"
                }
              />

              <NumberField
                label="Maximum Discount"
                value={form.maxDiscount}
                onChange={(value) =>
                  update("maxDiscount", value)
                }
                placeholder="1000"
                suffix="₹"
              />

              <NumberField
                label="Minimum Order Value"
                value={form.minOrderValue}
                onChange={(value) =>
                  update("minOrderValue", value)
                }
                placeholder="999"
                suffix="₹"
              />

              <NumberField
                label="Usage Limit"
                value={form.usageLimit}
                onChange={(value) =>
                  update("usageLimit", value)
                }
                placeholder="1000"
                suffix="uses"
              />
            </div>

            <SectionTitle
              title="Customer Targeting"
              description="Promotion kis customer group ke liye hai."
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Customer Type"
                value={form.targetType}
                onChange={(value) =>
                  update(
                    "targetType",
                    value as TargetType
                  )
                }
                options={[
                  ["all", "All Customers"],
                  ["retail", "Retail Customers"],
                  ["wholesale", "Wholesale Customers"],
                ]}
              />

              <Field
                label="Category ID"
                value={form.categoryId}
                onChange={(value) =>
                  update("categoryId", value)
                }
                placeholder="category-id"
              />

              <Field
                label="Category Name"
                value={form.categoryName}
                onChange={(value) =>
                  update("categoryName", value)
                }
                placeholder="Ladies Wear"
              />

              <Field
                label="Product ID"
                value={form.productId}
                onChange={(value) =>
                  update("productId", value)
                }
                placeholder="product-id"
              />

              <Field
                label="Product Name"
                value={form.productName}
                onChange={(value) =>
                  update("productName", value)
                }
                placeholder="Product name"
              />

              <Field
                label="Seller ID"
                value={form.sellerId}
                onChange={(value) =>
                  update("sellerId", value)
                }
                placeholder="seller-id"
              />

              <Field
                label="Seller Name"
                value={form.sellerName}
                onChange={(value) =>
                  update("sellerName", value)
                }
                placeholder="Seller name"
              />
            </div>

            <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-700">
              Targeting fields optional hain. Agar sab blank
              hain, promotion ko global campaign ki tarah use
              kiya ja sakta hai.
            </p>

            <SectionTitle
              title="Homepage Banner"
              description="Promotion ko ANJIVO homepage par highlight karne ke liye."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Banner Image URL"
                value={form.bannerImage}
                onChange={(value) =>
                  update("bannerImage", value)
                }
                placeholder="https://..."
              />

              <Field
                label="Banner Title"
                value={form.bannerTitle}
                onChange={(value) =>
                  update("bannerTitle", value)
                }
                placeholder="Mega Sale is Live!"
              />

              <div className="md:col-span-2">
                <Field
                  label="Banner Subtitle"
                  value={form.bannerSubtitle}
                  onChange={(value) =>
                    update("bannerSubtitle", value)
                  }
                  placeholder="Shop now and save more..."
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleField
                label="Featured Promotion"
                description="Promotion ko featured campaigns mein show karein."
                checked={form.featured}
                onChange={(value) =>
                  update("featured", value)
                }
              />

              <ToggleField
                label="Show on Homepage"
                description="Promotion ko homepage promotional section mein show karein."
                checked={form.homepage}
                onChange={(value) =>
                  update("homepage", value)
                }
              />
            </div>

            <SectionTitle
              title="Schedule"
              description="Campaign kab start aur end hogi."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <DateField
                label="Start Date & Time"
                value={form.startsAt}
                onChange={(value) =>
                  update("startsAt", value)
                }
              />

              <DateField
                label="End Date & Time"
                value={form.endsAt}
                onChange={(value) =>
                  update("endsAt", value)
                }
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                Important
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700">
                Discount calculation checkout ke time
                trusted backend/server side par validate karna
                zaroori hoga. Client-side promotion data ko
                final authority nahi maana jana chahiye.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : editing
              ? "Update Promotion"
              : "Create Promotion"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      {textarea ? (
        <textarea
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      ) : (
        <input
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      )}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  required,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <div className="relative">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-14 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />

        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>

      <input
        type="datetime-local"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
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
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option
            key={optionValue}
            value={optionValue}
          >
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
        checked
          ? "border-indigo-200 bg-indigo-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
          checked
            ? "bg-indigo-600"
            : "bg-slate-300"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>

      <span>
        <span className="block text-sm font-bold text-slate-800">
          {label}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </button>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        🎯
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
