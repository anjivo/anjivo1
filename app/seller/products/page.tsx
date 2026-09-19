"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth, db } from "@/lib/firebase";
import {
  getSellerProducts,
} from "@/lib/seller-products";
import type { Product } from "@/types/product";

export default function SellerProductsPage() {
  const router = useRouter();

  const [products, setProducts] =
    useState<Product[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/seller/products"
            );
            return;
          }

          try {
            const userSnapshot =
              await import(
                "firebase/firestore"
              ).then(
                ({ getDoc, doc }) =>
                  getDoc(
                    doc(
                      db,
                      "users",
                      user.uid
                    )
                  )
              );

            if (
              !userSnapshot.exists() ||
              userSnapshot.data()
                .role !== "SELLER"
            ) {
              setError(
                "Seller access required."
              );
              return;
            }

            const result =
              await getSellerProducts(
                user.uid
              );

            setProducts(result);
          } catch (err) {
            console.error(err);

            setError(
              "Unable to load products."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>
            <Link
              href="/seller"
              className="text-xs font-bold text-gray-400 hover:text-black"
            >
              ← Seller Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-black">
              My Products
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage your ANJIVO marketplace products.
            </p>
          </div>

          <Link
            href="/seller/products/new"
            className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            + Add Product
          </Link>

        </div>

        {loading && (
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-10 text-center">
            ⏳ Loading products...
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          products.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">

              <div className="text-5xl">
                📦
              </div>

              <h2 className="mt-4 text-xl font-black">
                No products yet
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Add your first product to start selling.
              </p>

              <Link
                href="/seller/products/new"
                className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white"
              >
                Add Your First Product
              </Link>

            </div>
          )}

        {!loading &&
          !error &&
          products.length > 0 && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {products.map(
                (product) => (
                  <div
                    key={product.id}
                    className="overflow-hidden rounded-3xl border border-gray-200 bg-white"
                  >

                    <div className="flex aspect-square items-center justify-center bg-gray-100">

                      {product.images[0] ? (
                        <img
                          src={
                            product.images[0]
                          }
                          alt={
                            product.name
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl">
                          📦
                        </span>
                      )}

                    </div>

                    <div className="p-4">

                      <div className="flex items-start justify-between gap-2">

                        <h2 className="line-clamp-2 text-sm font-black">
                          {product.name}
                        </h2>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-bold uppercase ${
                            product.status ===
                            "active"
                              ? "bg-green-100 text-green-700"
                              : product.status ===
                                "blocked"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {product.status}
                        </span>

                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[9px] text-gray-400">
                            Retail
                          </p>

                          <p className="mt-1 text-sm font-black">
                            ₹
                            {product.retailPrice.toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[9px] text-gray-400">
                            Stock
                          </p>

                          <p className="mt-1 text-sm font-black">
                            {product.stock}
                          </p>
                        </div>

                      </div>

                      <div className="mt-4 flex gap-2">

                        <Link
                          href={`/products/${product.slug}`}
                          target="_blank"
                          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-center text-xs font-bold"
                        >
                          View
                        </Link>

                        <button
                          type="button"
                          className="flex-1 rounded-xl bg-black py-2.5 text-xs font-bold text-white"
                        >
                          Edit
                        </button>

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>
          )}

      </main>

      <Footer />

    </div>
  );
}
