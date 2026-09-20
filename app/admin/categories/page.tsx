"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  parentId: string;
  parentName: string;
  level: "category" | "subcategory";
  status: "active" | "inactive";
  productCount: number;
  featured: boolean;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  image: string;
  parentId: string;
  status: "active" | "inactive";
  featured: boolean;
  sortOrder: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  image: "",
  parentId: "",
  status: "active",
  featured: false,
  sortOrder: "0",
};

function stringValue(value: unknown): string {
  return value === undefined || value === null
    ? ""
    : String(value);
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function mapCategory(
  id: string,
  data: Record<string, unknown>
): Category {
  const parentId = stringValue(data.parentId);

  return {
    id,
    name: stringValue(data.name),
    slug: stringValue(data.slug),
    description: stringValue(data.description),
    image: stringValue(data.image),
    parentId,
    parentName: stringValue(data.parentName),
    level: parentId ? "subcategory" : "category",
    status:
      data.status === "inactive"
        ? "inactive"
        : "active",
    productCount: numberValue(
      data.productCount
    ),
    featured: booleanValue(data.featured),
    sortOrder: numberValue(data.sortOrder),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export default function AdminCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [categories, setCategories] = useState<Category[]>(
    []
  );

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(
    null
  );

  const [form, setForm] = useState<FormState>({
    ...emptyForm,
  });

  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          window.location.href =
            "/login?redirect=/admin/categories";
          return;
        }

        try {
          const snapshot = await getDoc(
            doc(db, "users", user.uid)
          );

          if (!snapshot.exists()) {
            window.location.href = "/";
            return;
          }

          if (snapshot.data().role !== "ADMIN") {
            window.location.href = "/account";
            return;
          }

          setAuthorized(true);
          await loadCategories();
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

    return () => unsubscribe();
  }, []);

  async function loadCategories() {
    try {
      setError("");

      const snapshot = await getDocs(
        collection(db, "categories")
      );

      const list = snapshot.docs.map((item) =>
        mapCategory(item.id, item.data())
      );

      list.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }

        return (
          timestampValue(a.createdAt) -
          timestampValue(b.createdAt)
        );
      });

      setCategories(list);
    } catch (err) {
      console.error(err);
      setError(
        "Categories load nahi ho paayi."
      );
    }
  }

  function openCreateForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function openEditForm(category: Category) {
    setEditingId(category.id);

    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      parentId: category.parentId,
      status: category.status,
      featured: category.featured,
      sortOrder: String(category.sortOrder),
    });

    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function saveCategory() {
    const name = form.name.trim();

    if (!name) {
      setError("Category name required hai.");
      return;
    }

    const parent = categories.find(
      (category) =>
        category.id === form.parentId
    );

    if (
      form.parentId &&
      (!parent ||
        parent.parentId)
    ) {
      setError(
        "Subcategory sirf main category ke andar create ho sakti hai."
      );
      return;
    }

    const slug =
      form.slug.trim() ||
      slugify(name);

    if (!slug) {
      setError("Valid slug required hai.");
      return;
    }

    const duplicate = categories.find(
      (category) =>
        category.slug === slug &&
        category.id !== editingId
    );

    if (duplicate) {
      setError(
        "Ye slug already use ho raha hai."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const categoryData = {
        name,
        slug,
        description:
          form.description.trim(),
        image: form.image.trim(),
        parentId: parent?.id || "",
        parentName: parent?.name || "",
        status: form.status,
        featured: form.featured,
        sortOrder:
          Number(form.sortOrder) || 0,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(
            db,
            "categories",
            editingId
          ),
          categoryData
        );

        setSuccess(
          "Category successfully updated."
        );
      } else {
        await addDoc(
          collection(db, "categories"),
          {
            ...categoryData,
            productCount: 0,
            createdAt:
              serverTimestamp(),
          }
        );

        setSuccess(
          "Category successfully created."
        );
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });

      await loadCategories();
    } catch (err) {
      console.error(err);
      setError(
        "Category save nahi ho paayi. Firestore rules check karein."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(
    category: Category
  ) {
    try {
      setProcessing(category.id);
      setError("");
      setSuccess("");

      const nextStatus =
        category.status === "active"
          ? "inactive"
          : "active";

      await updateDoc(
        doc(
          db,
          "categories",
          category.id
        ),
        {
          status: nextStatus,
          updatedAt:
            serverTimestamp(),
        }
      );

      setCategories((current) =>
        current.map((item) =>
          item.id === category.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );

      setSuccess(
        `${category.name} is now ${nextStatus}.`
      );
    } catch (err) {
      console.error(err);
      setError(
        "Category status update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function toggleFeatured(
    category: Category
  ) {
    try {
      setProcessing(category.id);
      setError("");
      setSuccess("");

      const nextValue =
        !category.featured;

      await updateDoc(
        doc(
          db,
          "categories",
          category.id
        ),
        {
          featured: nextValue,
          updatedAt:
            serverTimestamp(),
        }
      );

      setCategories((current) =>
        current.map((item) =>
          item.id === category.id
            ? {
                ...item,
                featured: nextValue,
              }
            : item
        )
      );

      setSuccess(
        `${category.name} featured status updated.`
      );
    } catch (err) {
      console.error(err);
      setError(
        "Featured status update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function disableCategory(
    category: Category
  ) {
    const confirmed = window.confirm(
      `Disable "${category.name}"?\n\nCategory permanently delete nahi hogi.`
    );

    if (!confirmed) return;

    try {
      setProcessing(category.id);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "categories",
          category.id
        ),
        {
          status: "inactive",
          updatedAt:
            serverTimestamp(),
        }
      );

      setCategories((current) =>
        current.map((item) =>
          item.id === category.id
            ? {
                ...item,
                status: "inactive",
              }
            : item
        )
      );

      setSuccess(
        `${category.name} disabled.`
      );
    } catch (err) {
      console.error(err);
      setError(
        "Category disable nahi ho paayi."
      );
    } finally {
      setProcessing(null);
    }
  }

  const filteredCategories = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) return categories;

    return categories.filter(
      (category) =>
        category.name
          .toLowerCase()
          .includes(query) ||
        category.slug
          .toLowerCase()
          .includes(query) ||
        category.parentName
          .toLowerCase()
          .includes(query)
    );
  }, [categories, search]);

  const mainCategories =
    categories.filter(
      (category) =>
        category.level === "category"
    );

  const activeCount =
    categories.filter(
      (category) =>
        category.status === "active"
    ).length;

  const inactiveCount =
    categories.filter(
      (category) =>
        category.status === "inactive"
    ).length;

  const subcategoryCount =
    categories.filter(
      (category) =>
        category.level ===
        "subcategory"
    ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading Category Management...
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
              href="/admin/products"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Products
            </Link>

            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white"
            >
              + Add Category
            </button>

          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">

        {/* TITLE */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              ADMIN / CATEGORIES
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
              Category Management
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              ANJIVO marketplace ke categories
              aur subcategories manage karein.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadCategories()}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold hover:border-black"
          >
            ↻ Refresh
          </button>

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

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">

          <StatCard
            label="Total"
            value={categories.length}
          />

          <StatCard
            label="Main Categories"
            value={mainCategories.length}
          />

          <StatCard
            label="Subcategories"
            value={subcategoryCount}
          />

          <StatCard
            label="Active"
            value={activeCount}
          />

        </div>

        {/* SEARCH */}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-3">

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search category, subcategory or slug..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
          />

        </div>

        {/* FORM */}

        {showForm && (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <div className="flex items-center justify-between gap-4">

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                  {editingId
                    ? "EDIT CATEGORY"
                    : "NEW CATEGORY"}
                </p>

                <h2 className="mt-1 text-xl font-black">
                  {editingId
                    ? "Edit Category"
                    : "Create Category"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border px-4 py-2 text-xs font-bold"
              >
                Close
              </button>

            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">

              <FormField
                label="Category Name *"
                value={form.name}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    name: value,
                    slug:
                      current.slug ||
                      slugify(value),
                  }))
                }
                placeholder="Example: Cosmetics"
              />

              <FormField
                label="Slug *"
                value={form.slug}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    slug: slugify(value),
                  }))
                }
                placeholder="cosmetics"
              />

              <div>
                <label className="text-xs font-black text-gray-600">
                  Parent Category
                </label>

                <select
                  value={form.parentId}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        parentId:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="">
                    Main Category
                  </option>

                  {mainCategories
                    .filter(
                      (category) =>
                        category.id !==
                        editingId
                    )
                    .map(
                      (category) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {
                            category.name
                          }
                        </option>
                      )
                    )}
                </select>
              </div>

              <FormField
                label="Image URL"
                value={form.image}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    image: value,
                  }))
                }
                placeholder="https://..."
              />

              <FormField
                label="Sort Order"
                value={form.sortOrder}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    sortOrder: value,
                  }))
                }
                placeholder="0"
                type="number"
              />

              <div>
                <label className="text-xs font-black text-gray-600">
                  Status
                </label>

                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target
                            .value as
                            | "active"
                            | "inactive",
                      })
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>

              <div className="md:col-span-2">

                <label className="text-xs font-black text-gray-600">
                  Description
                </label>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target
                            .value,
                      })
                    )
                  }
                  rows={4}
                  placeholder="Category description..."
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">

                <input
                  type="checkbox"
                  checked={
                    form.featured
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        featured:
                          event.target
                            .checked,
                      })
                    )
                  }
                  className="h-4 w-4"
                />

                <div>
                  <p className="text-sm font-black">
                    Featured Category
                  </p>

                  <p className="text-xs text-gray-500">
                    Homepage par feature
                    ki ja sakti hai.
                  </p>
                </div>

              </label>

            </div>

            <div className="mt-6 flex flex-wrap gap-3">

              <button
                type="button"
                disabled={saving}
                onClick={
                  saveCategory
                }
                className="rounded-xl bg-black px-6 py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Category"
                  : "Create Category"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={
                  closeForm
                }
                className="rounded-xl border border-gray-200 px-6 py-3 text-xs font-black"
              >
                Cancel
              </button>

            </div>

          </div>
        )}

        {/* CATEGORY LIST */}

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">

          {filteredCategories.length ===
          0 ? (
            <div className="p-14 text-center">

              <div className="text-5xl">
                🗂️
              </div>

              <h2 className="mt-4 text-lg font-black">
                No categories found
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                "+ Add Category" se pehli
                category create karein.
              </p>

            </div>
          ) : (
            <div className="divide-y divide-gray-100">

              {filteredCategories.map(
                (category) => (
                  <CategoryRow
                    key={
                      category.id
                    }
                    category={
                      category
                    }
                    processing={
                      processing ===
                      category.id
                    }
                    onEdit={() =>
                      openEditForm(
                        category
                      )
                    }
                    onToggleStatus={() =>
                      toggleStatus(
                        category
                      )
                    }
                    onToggleFeatured={() =>
                      toggleFeatured(
                        category
                      )
                    }
                    onDisable={() =>
                      disableCategory(
                        category
                      )
                    }
                  />
                )
              )}

            </div>
          )}

        </div>

        {/* NOTE */}

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">

          <p className="text-xs font-black text-blue-800">
            Category structure
          </p>

          <p className="mt-1 text-xs leading-5 text-blue-700">
            Main Category → Subcategory
            structure use ho raha hai. Abhi
            subcategory ke andar third-level
            category intentionally allow nahi
            ki gayi hai.
          </p>

        </div>

      </div>
    </main>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-black text-gray-600">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
      />
    </div>
  );
}

/* =========================================================
   CATEGORY ROW
========================================================= */

function CategoryRow({
  category,
  processing,
  onEdit,
  onToggleStatus,
  onToggleFeatured,
  onDisable,
}: {
  category: Category;
  processing: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onToggleFeatured: () => void;
  onDisable: () => void;
}) {
  const isSubcategory =
    category.level ===
    "subcategory";

  return (
    <div
      className={`p-5 sm:p-6 ${
        isSubcategory
          ? "bg-gray-50/60"
          : "bg-white"
      }`}
    >

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex min-w-0 gap-4">

          {/* IMAGE */}

          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">

            {category.image ? (
              <img
                src={category.image}
                alt={category.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl">
                🗂️
              </span>
            )}

          </div>

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              {isSubcategory && (
                <span className="text-gray-400">
                  ↳
                </span>
              )}

              <h2 className="text-base font-black text-gray-900">
                {category.name}
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-black ${
                  category.status ===
                  "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {category.status.toUpperCase()}
              </span>

              {category.featured && (
                <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[9px] font-black text-yellow-700">
                  ★ FEATURED
                </span>
              )}

            </div>

            <p className="mt-1 text-xs font-semibold text-gray-400">
              /{category.slug}
            </p>

            {isSubcategory && (
              <p className="mt-1 text-xs font-bold text-gray-500">
                Parent:{" "}
                {category.parentName ||
                  "Unknown"}
              </p>
            )}

            {category.description && (
              <p className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">
                {category.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">

              <span className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">
                Products:{" "}
                {category.productCount}
              </span>

              <span className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">
                Sort:{" "}
                {category.sortOrder}
              </span>

            </div>

          </div>

        </div>

        {/* ACTIONS */}

        <div className="flex flex-wrap gap-2 lg:justify-end">

          <button
            type="button"
            disabled={processing}
            onClick={onEdit}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black hover:border-black disabled:opacity-50"
          >
            Edit
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={
              onToggleFeatured
            }
            className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-xs font-black text-yellow-700 disabled:opacity-50"
          >
            {category.featured
              ? "Unfeature"
              : "Feature"}
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={
              onToggleStatus
            }
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black disabled:opacity-50"
          >
            {category.status ===
            "active"
              ? "Deactivate"
              : "Activate"}
          </button>

          {category.status ===
            "active" && (
            <button
              type="button"
              disabled={processing}
              onClick={onDisable}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              Disable
            </button>
          )}

        </div>

      </div>
    </div>
  );
}
