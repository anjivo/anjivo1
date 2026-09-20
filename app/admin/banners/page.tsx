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

type BannerStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "expired"
  | "paused";

type BannerPlacement =
  | "homepage_hero"
  | "homepage_secondary"
  | "category"
  | "wholesale"
  | "retail";

type BannerTargetType =
  | "none"
  | "category"
  | "product"
  | "seller"
  | "promotion"
  | "url";

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  description: string;

  desktopImage: string;
  mobileImage: string;

  placement: BannerPlacement;
  targetType: BannerTargetType;

  targetId: string;
  targetName: string;
  targetUrl: string;

  buttonText: string;

  priority: number;

  startsAt?: unknown;
  endsAt?: unknown;

  status: BannerStatus;

  active: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type FormState = {
  title: string;
  subtitle: string;
  description: string;

  desktopImage: string;
  mobileImage: string;

  placement: BannerPlacement;
  targetType: BannerTargetType;

  targetId: string;
  targetName: string;
  targetUrl: string;

  buttonText: string;

  priority: string;

  startsAt: string;
  endsAt: string;

  active: boolean;
};

const emptyForm: FormState = {
  title: "",
  subtitle: "",
  description: "",

  desktopImage: "",
  mobileImage: "",

  placement: "homepage_hero",
  targetType: "none",

  targetId: "",
  targetName: "",
  targetUrl: "",

  buttonText: "Shop Now",

  priority: "0",

  startsAt: "",
  endsAt: "",

  active: true,
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
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
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis ===
      "function"
  ) {
    return (
      value as { toMillis: () => number }
    ).toMillis();
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

  const pad = (number: number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function calculateStatus(
  startsAt: unknown,
  endsAt: unknown,
  active: boolean
): BannerStatus {
  if (!active) return "paused";

  const now = Date.now();

  const start = timestampValue(startsAt);
  const end = timestampValue(endsAt);

  if (start && now < start) {
    return "scheduled";
  }

  if (end && now > end) {
    return "expired";
  }

  return "active";
}

function mapBanner(
  id: string,
  data: Record<string, unknown>
): Banner {
  const active = booleanValue(data.active);

  return {
    id,

    title: stringValue(data.title),
    subtitle: stringValue(data.subtitle),
    description: stringValue(data.description),

    desktopImage: stringValue(data.desktopImage),
    mobileImage: stringValue(data.mobileImage),

    placement:
      data.placement === "homepage_secondary" ||
      data.placement === "category" ||
      data.placement === "wholesale" ||
      data.placement === "retail"
        ? data.placement
        : "homepage_hero",

    targetType:
      data.targetType === "category" ||
      data.targetType === "product" ||
      data.targetType === "seller" ||
      data.targetType === "promotion" ||
      data.targetType === "url"
        ? data.targetType
        : "none",

    targetId: stringValue(data.targetId),
    targetName: stringValue(data.targetName),
    targetUrl: stringValue(data.targetUrl),

    buttonText:
      stringValue(data.buttonText) || "Shop Now",

    priority: numberValue(data.priority),

    startsAt: data.startsAt,
    endsAt: data.endsAt,

    status: calculateStatus(
      data.startsAt,
      data.endsAt,
      active
    ),

    active,

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

function placementLabel(
  placement: BannerPlacement
): string {
  const labels: Record<BannerPlacement, string> = {
    homepage_hero: "Homepage Hero",
    homepage_secondary: "Homepage Secondary",
    category: "Category",
    wholesale: "Wholesale",
    retail: "Retail",
  };

  return labels[placement];
}

function targetLabel(
  targetType: BannerTargetType
): string {
  const labels: Record<BannerTargetType, string> = {
    none: "No Target",
    category: "Category",
    product: "Product",
    seller: "Seller",
    promotion: "Promotion",
    url: "Custom URL",
  };

  return labels[targetType];
}

export default function AdminBannersPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);

  const [banners, setBanners] = useState<Banner[]>([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "all" | BannerStatus
  >("all");

  const [placementFilter, setPlacementFilter] = useState<
    "all" | BannerPlacement
  >("all");

  const [showModal, setShowModal] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(
    null
  );

  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          window.location.href =
            "/login?redirect=/admin/banners";
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

          await loadBanners();
        } catch (error) {
          console.error(
            "Admin authorization error:",
            error
          );

          window.location.href = "/";
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  async function loadBanners() {
    try {
      const snapshot = await getDocs(
        collection(db, "banners")
      );

      const list = snapshot.docs.map((item) =>
        mapBanner(item.id, item.data())
      );

      list.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }

        return (
          timestampValue(b.createdAt) -
          timestampValue(a.createdAt)
        );
      });

      setBanners(list);
    } catch (error) {
      console.error("Load banners error:", error);

      alert(
        "Banners load nahi ho paaye. Firestore rules check karein."
      );
    }
  }

  const filteredBanners = useMemo(() => {
    const query = search.trim().toLowerCase();

    return banners.filter((banner) => {
      const matchesSearch =
        !query ||
        banner.title
          .toLowerCase()
          .includes(query) ||
        banner.subtitle
          .toLowerCase()
          .includes(query) ||
        banner.targetName
          .toLowerCase()
          .includes(query) ||
        banner.targetId
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        banner.status === statusFilter;

      const matchesPlacement =
        placementFilter === "all" ||
        banner.placement === placementFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPlacement
      );
    });
  }, [
    banners,
    search,
    statusFilter,
    placementFilter,
  ]);

  const stats = useMemo(() => {
    return {
      total: banners.length,

      active: banners.filter(
        (item) => item.status === "active"
      ).length,

      scheduled: banners.filter(
        (item) => item.status === "scheduled"
      ).length,

      paused: banners.filter(
        (item) => item.status === "paused"
      ).length,

      expired: banners.filter(
        (item) => item.status === "expired"
      ).length,

      homepage: banners.filter(
        (item) =>
          item.placement === "homepage_hero" ||
          item.placement === "homepage_secondary"
      ).length,
    };
  }, [banners]);

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(banner: Banner) {
    setEditingId(banner.id);

    setForm({
      title: banner.title,
      subtitle: banner.subtitle,
      description: banner.description,

      desktopImage: banner.desktopImage,
      mobileImage: banner.mobileImage,

      placement: banner.placement,
      targetType: banner.targetType,

      targetId: banner.targetId,
      targetName: banner.targetName,
      targetUrl: banner.targetUrl,

      buttonText: banner.buttonText,

      priority: String(banner.priority),

      startsAt: toDateTimeLocal(banner.startsAt),
      endsAt: toDateTimeLocal(banner.endsAt),

      active: banner.active,
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveBanner() {
    const title = form.title.trim();

    const priority = Number(
      form.priority || 0
    );

    if (!title) {
      alert("Banner title required hai.");
      return;
    }

    if (!form.desktopImage.trim()) {
      alert("Desktop banner image URL required hai.");
      return;
    }

    if (
      !Number.isFinite(priority) ||
      priority < 0
    ) {
      alert("Valid priority enter karein.");
      return;
    }

    if (
      form.targetType === "url" &&
      !form.targetUrl.trim()
    ) {
      alert(
        "Custom URL target ke liye URL required hai."
      );
      return;
    }

    if (
      form.targetType !== "none" &&
      form.targetType !== "url" &&
      !form.targetId.trim()
    ) {
      alert(
        "Selected target ke liye Target ID required hai."
      );
      return;
    }

    if (form.startsAt && form.endsAt) {
      const start = new Date(
        form.startsAt
      ).getTime();

      const end = new Date(
        form.endsAt
      ).getTime();

      if (start >= end) {
        alert(
          "Start date end date se pehle honi chahiye."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        title,

        subtitle: form.subtitle.trim(),

        description:
          form.description.trim(),

        desktopImage:
          form.desktopImage.trim(),

        mobileImage:
          form.mobileImage.trim(),

        placement: form.placement,

        targetType: form.targetType,

        targetId: form.targetId.trim(),

        targetName:
          form.targetName.trim(),

        targetUrl:
          form.targetUrl.trim(),

        buttonText:
          form.buttonText.trim() || "Shop Now",

        priority,

        startsAt: form.startsAt
          ? new Date(form.startsAt)
          : null,

        endsAt: form.endsAt
          ? new Date(form.endsAt)
          : null,

        active: form.active,

        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, "banners", editingId),
          payload
        );
      } else {
        await addDoc(
          collection(db, "banners"),
          {
            ...payload,
            createdAt: serverTimestamp(),
          }
        );
      }

      await loadBanners();

      closeModal();

      alert(
        editingId
          ? "Banner successfully updated."
          : "Banner successfully created."
      );
    } catch (error) {
      console.error(
        "Save banner error:",
        error
      );

      alert(
        "Banner save nahi ho paaya. Firestore rules check karein."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleBanner(
    banner: Banner
  ) {
    try {
      await updateDoc(
        doc(db, "banners", banner.id),
        {
          active: !banner.active,
          updatedAt: serverTimestamp(),
        }
      );

      await loadBanners();
    } catch (error) {
      console.error(
        "Toggle banner error:",
        error
      );

      alert(
        "Banner status update nahi ho saka."
      );
    }
  }

  async function deleteBanner(
    banner: Banner
  ) {
    const confirmed = window.confirm(
      `Kya aap "${banner.title}" ko delete karna chahte hain?`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(
        doc(db, "banners", banner.id)
      );

      await loadBanners();
    } catch (error) {
      console.error(
        "Delete banner error:",
        error
      );

      alert(
        "Banner delete nahi ho paaya."
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading banners...
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
                Marketing Banners
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Admin Home
            </Link>

            <button
              onClick={openCreateModal}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              + Create Banner
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
            Banner Management
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Homepage, category, retail aur wholesale
            promotional banners ko manage karein.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Total"
            value={stats.total}
            icon="🖼️"
          />

          <StatCard
            label="Active"
            value={stats.active}
            icon="🟢"
          />

          <StatCard
            label="Scheduled"
            value={stats.scheduled}
            icon="📅"
          />

          <StatCard
            label="Paused"
            value={stats.paused}
            icon="⏸️"
          />

          <StatCard
            label="Expired"
            value={stats.expired}
            icon="⏰"
          />

          <StatCard
            label="Homepage"
            value={stats.homepage}
            icon="🏠"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_200px_220px_auto]">
              <SearchBox
                value={search}
                onChange={setSearch}
              />

              <SelectBox
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(
                    value as
                      | "all"
                      | BannerStatus
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
                value={placementFilter}
                onChange={(value) =>
                  setPlacementFilter(
                    value as
                      | "all"
                      | BannerPlacement
                  )
                }
                options={[
                  ["all", "All Placements"],
                  [
                    "homepage_hero",
                    "Homepage Hero",
                  ],
                  [
                    "homepage_secondary",
                    "Homepage Secondary",
                  ],
                  ["category", "Category"],
                  ["retail", "Retail"],
                  ["wholesale", "Wholesale"],
                ]}
              />

              <button
                onClick={loadBanners}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {filteredBanners.length === 0 ? (
            <EmptyState
              title="No banners found"
              description={
                banners.length === 0
                  ? "Abhi koi banner create nahi hua hai."
                  : "Current filters ke according koi banner nahi mila."
              }
              action={
                banners.length === 0
                  ? {
                      label: "Create Banner",
                      onClick:
                        openCreateModal,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredBanners.map(
                (banner) => (
                  <BannerRow
                    key={banner.id}
                    banner={banner}
                    onEdit={() =>
                      openEditModal(
                        banner
                      )
                    }
                    onToggle={() =>
                      toggleBanner(
                        banner
                      )
                    }
                    onDelete={() =>
                      deleteBanner(
                        banner
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <BannerModal
          form={form}
          setForm={setForm}
          editing={Boolean(editingId)}
          saving={saving}
          onClose={closeModal}
          onSave={saveBanner}
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value.toLocaleString(
              "en-IN"
            )}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
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
        placeholder="Search banner, target, ID..."
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
      {options.map(
        ([optionValue, label]) => (
          <option
            key={optionValue}
            value={optionValue}
          >
            {label}
          </option>
        )
      )}
    </select>
  );
}

function BannerRow({
  banner,
  onEdit,
  onToggle,
  onDelete,
}: {
  banner: Banner;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            {banner.desktopImage ? (
              <img
                src={banner.desktopImage}
                alt={banner.title}
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display =
                    "none";
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl">
                🖼️
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-slate-900">
                {banner.title ||
                  "Untitled Banner"}
              </h3>

              <StatusBadge
                status={banner.status}
              />
            </div>

            {banner.subtitle && (
              <p className="mt-1 text-sm font-medium text-indigo-600">
                {banner.subtitle}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <InfoBadge
                label={placementLabel(
                  banner.placement
                )}
              />

              <InfoBadge
                label={targetLabel(
                  banner.targetType
                )}
              />

              <InfoBadge
                label={`Priority ${banner.priority}`}
              />

              {banner.targetName && (
                <InfoBadge
                  label={
                    banner.targetName
                  }
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
          <MiniInfo
            label="Start"
            value={formatDate(
              banner.startsAt
            )}
          />

          <MiniInfo
            label="End"
            value={formatDate(
              banner.endsAt
            )}
          />

          <MiniInfo
            label="Mobile Image"
            value={
              banner.mobileImage
                ? "Available"
                : "Not Set"
            }
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="text-xs text-slate-500">
          Created:{" "}
          {formatDate(
            banner.createdAt
          )}
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
              banner.active
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            }`}
          >
            {banner.active
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
  status: BannerStatus;
}) {
  const styles: Record<
    BannerStatus,
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
    BannerStatus,
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

function BannerModal({
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
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Marketing
            </p>

            <h2 className="text-xl font-bold text-slate-900">
              {editing
                ? "Edit Banner"
                : "Create Banner"}
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
              title="Banner Content"
              description="Customer ko banner mein kya dikhana hai."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Banner Title"
                required
                value={form.title}
                onChange={(value) =>
                  update("title", value)
                }
                placeholder="Big Festive Sale"
              />

              <Field
                label="Button Text"
                value={form.buttonText}
                onChange={(value) =>
                  update(
                    "buttonText",
                    value
                  )
                }
                placeholder="Shop Now"
              />

              <Field
                label="Subtitle"
                value={form.subtitle}
                onChange={(value) =>
                  update(
                    "subtitle",
                    value
                  )
                }
                placeholder="Up to 70% OFF"
              />

              <Field
                label="Priority"
                value={form.priority}
                onChange={(value) =>
                  update(
                    "priority",
                    value
                  )
                }
                placeholder="10"
                type="number"
              />

              <div className="md:col-span-2">
                <Field
                  label="Description"
                  value={
                    form.description
                  }
                  onChange={(value) =>
                    update(
                      "description",
                      value
                    )
                  }
                  placeholder="Optional banner description..."
                  textarea
                />
              </div>
            </div>

            <SectionTitle
              title="Banner Images"
              description="Desktop aur mobile devices ke liye images."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Desktop Image URL"
                required
                value={
                  form.desktopImage
                }
                onChange={(value) =>
                  update(
                    "desktopImage",
                    value
                  )
                }
                placeholder="https://..."
              />

              <Field
                label="Mobile Image URL"
                value={
                  form.mobileImage
                }
                onChange={(value) =>
                  update(
                    "mobileImage",
                    value
                  )
                }
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ImagePreview
                label="Desktop Preview"
                src={
                  form.desktopImage
                }
              />

              <ImagePreview
                label="Mobile Preview"
                src={
                  form.mobileImage
                }
              />
            </div>

            <SectionTitle
              title="Placement"
              description="Banner website ke kis section mein show hoga."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Placement"
                value={
                  form.placement
                }
                onChange={(value) =>
                  update(
                    "placement",
                    value as BannerPlacement
                  )
                }
                options={[
                  [
                    "homepage_hero",
                    "Homepage Hero",
                  ],
                  [
                    "homepage_secondary",
                    "Homepage Secondary",
                  ],
                  [
                    "category",
                    "Category Page",
                  ],
                  [
                    "retail",
                    "Retail Section",
                  ],
                  [
                    "wholesale",
                    "Wholesale Section",
                  ],
                ]}
              />

              <NumberField
                label="Priority"
                value={
                  form.priority
                }
                onChange={(value) =>
                  update(
                    "priority",
                    value
                  )
                }
                placeholder="0"
              />
            </div>

            <SectionTitle
              title="Target & Destination"
              description="Banner click karne par customer kahan jayega."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Target Type"
                value={
                  form.targetType
                }
                onChange={(value) =>
                  update(
                    "targetType",
                    value as BannerTargetType
                  )
                }
                options={[
                  [
                    "none",
                    "No Target",
                  ],
                  [
                    "category",
                    "Category",
                  ],
                  [
                    "product",
                    "Product",
                  ],
                  [
                    "seller",
                    "Seller",
                  ],
                  [
                    "promotion",
                    "Promotion",
                  ],
                  [
                    "url",
                    "Custom URL",
                  ],
                ]}
              />

              <Field
                label="Target ID"
                value={
                  form.targetId
                }
                onChange={(value) =>
                  update(
                    "targetId",
                    value
                  )
                }
                placeholder="product/category/seller ID"
              />

              <Field
                label="Target Name"
                value={
                  form.targetName
                }
                onChange={(value) =>
                  update(
                    "targetName",
                    value
                  )
                }
                placeholder="Target display name"
              />

              <Field
                label="Custom URL"
                value={
                  form.targetUrl
                }
                onChange={(value) =>
                  update(
                    "targetUrl",
                    value
                  )
                }
                placeholder="/products/example"
              />
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
              <strong>Example:</strong> Agar Target Type
              <strong> Product</strong> hai to Target ID mein
              product document ID aur Target Name mein product
              ka naam rakhein.
            </div>

            <SectionTitle
              title="Schedule"
              description="Banner kab automatically show hoga."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <DateField
                label="Start Date & Time"
                value={
                  form.startsAt
                }
                onChange={(value) =>
                  update(
                    "startsAt",
                    value
                  )
                }
              />

              <DateField
                label="End Date & Time"
                value={
                  form.endsAt
                }
                onChange={(value) =>
                  update(
                    "endsAt",
                    value
                  )
                }
              />
            </div>

            <ToggleField
              label="Banner Active"
              description="Active hone par banner website ke relevant section mein show ho sakta hai."
              checked={form.active}
              onChange={(value) =>
                update(
                  "active",
                  value
                )
              }
            />

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-800">
                Banner system
              </p>

              <p className="mt-1 text-xs leading-5 text-blue-700">
                Banner ka final display homepage/category
                component mein Firestore se active banners
                fetch karke hoga. Is admin module mein banner
                management aur scheduling ready hai.
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
              ? "Update Banner"
              : "Create Banner"}
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {textarea ? (
        <textarea
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          placeholder={placeholder}
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>

      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
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
          onChange(
            event.target.value
          )
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
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          )
        )}
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
      onClick={() =>
        onChange(!checked)
      }
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
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
            checked
              ? "translate-x-4"
              : "translate-x-0"
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

function ImagePreview({
  label,
  src,
}: {
  label: string;
  src: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-700">
        {label}
      </p>

      <div className="aspect-[16/6] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {src ? (
          <img
            src={src}
            alt={label}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Image preview
          </div>
        )}
      </div>
    </div>
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
        🖼️
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
