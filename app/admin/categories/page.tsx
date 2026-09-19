"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  addDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
} from "firebase/auth";

import { auth, db } from "@/lib/firebase";
import type { Category } from "@/types/category";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [featured, setFeatured] = useState(false);
  const [trending, setTrending] = useState(false);

  async function loadCategories() {
    try {
      const q = query(
        collection(db, "categories"),
        where("status", "==", "active")
      );

      const snapshot = await getDocs(q);

      const data: Category[] = snapshot.docs
        .map((item) => {
          const value = item.data();

          return {
            id: item.id,
            name: String(value.name ?? ""),
            slug: String(value.slug ?? ""),
            description: String(value.description ?? ""),
            icon: String(value.icon ?? ""),
            parentId:
              value.parentId === undefined
                ? null
                : value.parentId,
            productCount: Number(
              value.productCount ?? 0
            ),
            featured: Boolean(value.featured),
            trending: Boolean(value.trending),
            status:
              value.status === "inactive"
                ? "inactive"
                : "active",
            sortOrder: Number(
              value.sortOrder ?? 0
            ),
            createdAt: value.createdAt,
            updatedAt: value.updatedAt,
          };
        })
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) -
            (b.sortOrder ?? 0)
        );

      setCategories(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          window.location.href = "/login";
          return;
        }

        const userSnapshot = await getDocs(
          query(
            collection(db, "users"),
            where("uid", "==", user.uid)
          )
        );

        if (userSnapshot.empty) {
          window.location.href = "/";
          return;
        }

        const userData =
          userSnapshot.docs[0].data();

        if (userData.role !== "ADMIN") {
          window.location.href = "/";
          return;
        }

        await loadCategories();
      }
    );

    return () => unsubscribe();
  }, []);

  function makeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function handleCreateCategory(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Category name required.");
      return;
    }

    const finalSlug =
      slug.trim() || makeSlug(name);

    if (!finalSlug) {
      alert("Valid category slug required.");
      return;
    }

    try {
      setSaving(true);

      await addDoc(
        collection(db, "categories"),
        {
          name: name.trim(),
          slug: finalSlug,
          description: description.trim(),
          icon: icon.trim(),
          parentId: null,
          productCount: 0,
          featured,
          trending,
          status: "active",
          sortOrder: Number(sortOrder) || 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setName("");
      setSlug("");
      setDescription("");
      setIcon("");
      setSortOrder("0");
      setFeatured(false);
      setTrending(false);

      await loadCategories();

      alert("Category created successfully.");
    } catch (error) {
      console.error(error);
      alert("Category create nahi ho payi.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(
    category: Category
  ) {
    try {
      await updateDoc(
        doc(db, "categories", category.id),
        {
          status:
            category.status === "active"
              ? "inactive"
              : "active",
          updatedAt: serverTimestamp(),
        }
      );

      await loadCategories();
    } catch (error) {
      console.error(error);
      alert("Status update failed.");
    }
  }

  async function removeCategory(
    category: Category
  ) {
    const confirmed = window.confirm(
      `Delete "${category.name}"?`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(
        doc(db, "categories", category.id)
      );

      await loadCategories();
    } catch (error) {
      console.error(error);
      alert("Delete failed.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-sm font-medium text-blue-600"
            >
              ← Admin Dashboard
            </Link>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Category Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Create and manage ANJIVO categories.
            </p>
          </div>
        </div>

        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-900">
            Add New Category
          </h2>

          <form
            onSubmit={handleCreateCategory}
            className="grid gap-5 md:grid-cols-2"
          >
            <div>
              <label className="mb-2 block text-sm font-medium">
                Category Name
              </label>

              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);

                  if (!slug) {
                    setSlug(
                      makeSlug(e.target.value)
                    );
                  }
                }}
                placeholder="Fashion"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Slug
              </label>

              <input
                value={slug}
                onChange={(e) =>
                  setSlug(
                    makeSlug(e.target.value)
                  )
                }
                placeholder="fashion"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Icon / Emoji
              </label>

              <input
                value={icon}
                onChange={(e) =>
                  setIcon(e.target.value)
                }
                placeholder="👕"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Sort Order
              </label>

              <input
                type="number"
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value)
                }
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                rows={3}
                placeholder="Fashion products for retail and wholesale buyers"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) =>
                    setFeatured(e.target.checked)
                  }
                />
                Featured
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={trending}
                  onChange={(e) =>
                    setTrending(e.target.checked)
                  }
                />
                Trending
              </label>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create Category"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Categories
            </h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
              {categories.length}
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-500">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
              No categories found.
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                      {category.icon || "📦"}
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900">
                        {category.name}
                      </h3>

                      <p className="text-sm text-slate-500">
                        /{category.slug}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {category.featured && (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                            Featured
                          </span>
                        )}

                        {category.trending && (
                          <span className="rounded-full bg-purple-50 px-2 py-1 text-purple-700">
                            Trending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        toggleStatus(category)
                      }
                      className="rounded-lg border px-3 py-2 text-sm font-medium"
                    >
                      {category.status === "active"
                        ? "Deactivate"
                        : "Activate"}
                    </button>

                    <button
                      onClick={() =>
                        removeCategory(category)
                      }
                      className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
