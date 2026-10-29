
"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type WishlistItem = {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string;
  retailPrice: number;
  mrp: number;
  createdAt?: unknown;
};

function toWishlistItem(
  id: string,
  data: DocumentData
): WishlistItem {
  return {
    id,
    productId: String(data.productId || id),
    name: String(data.name || data.productName || "Product"),
    slug: String(data.slug || ""),
    image: String(data.image || data.images?.[0] || ""),
    retailPrice: Number(data.retailPrice ?? data.price ?? 0),
    mrp: Number(data.mrp ?? 0),
    createdAt: data.createdAt,
  };
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function WishlistPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWishlist = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");

    try {
      const wishlistRef = collection(
        db,
        "wishlists",
        currentUser.uid,
        "items"
      );

      let snapshots;

      try {
        snapshots = await getDocs(
          query(wishlistRef, orderBy("createdAt", "desc"))
        );
      } catch {
        // Older wishlist documents may not have createdAt.
        snapshots = await getDocs(wishlistRef);
      }

      const loadedItems = snapshots.docs.map((item) =>
        toWishlistItem(item.id, item.data())
      );

      setItems(loadedItems);
    } catch (err) {
      console.error("Load wishlist failed:", err);
      setError(
        "Wishlist load nahi ho saki. Firestore rules aur connection check karein."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setItems([]);
        setLoading(false);
        router.replace("/login?redirect=/account/wishlist");
        return;
      }

      if (!active) return;
      setUser(currentUser);
      await loadWishlist(currentUser);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadWishlist, router]);

  async function removeItem(item: WishlistItem) {
    if (!user || removingId) return;

    setRemovingId(item.id);
    setError("");
    setNotice("");

    try {
      await deleteDoc(
        doc(db, "wishlists", user.uid, "items", item.id)
      );

      setItems((current) =>
        current.filter((saved) => saved.id !== item.id)
      );
      setNotice("Product wishlist se remove ho gaya.");
    } catch (err) {
      console.error("Remove wishlist item failed:", err);
      setError(
        "Product remove nahi hua. Firestore permissions check karein."
      );
    } finally {
      setRemovingId("");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              ANJIVO Account
            </p>
            <h1 className="mt-1 text-2xl font-black text-gray-950 sm:text-3xl">
              My Wishlist
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Your saved products, all in one place.
            </p>
          </div>

          <Link
            href="/account"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-black"
          >
            Back to Account
          </Link>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
            {!loading && user && (
              <button
                type="button"
                onClick={() => void loadWishlist(user)}
                className="ml-2 font-bold underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {notice && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {notice}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">
              Wishlist load ho rahi hai...
            </p>
          </div>
        ) : items.length === 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white px-5 py-16 text-center">
            <div className="text-5xl" aria-hidden="true">
              ♡
            </div>
            <h2 className="mt-4 text-xl font-black text-gray-950">
              Your wishlist is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Jo products pasand aayein, unhe wishlist mein save karein.
              Aap unhe baad mein yahan dekh sakte hain.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
            >
              Browse Products
            </Link>
          </section>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500">
              {items.length} saved {items.length === 1 ? "product" : "products"}
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item) => {
                const detailUrl = item.slug
                  ? `/products/${encodeURIComponent(item.slug)}`
                  : "";

                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/5] bg-gray-100">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-400">
                          No image available
                        </div>
                      )}
                    </div>

                    <div className="p-3 sm:p-4">
                      <h2 className="line-clamp-2 min-h-10 text-sm font-bold text-gray-900">
                        {item.name}
                      </h2>

                      <div className="mt-2 flex flex-wrap items-baseline gap-2">
                        {item.retailPrice > 0 && (
                          <span className="text-base font-black text-gray-950">
                            {formatPrice(item.retailPrice)}
                          </span>
                        )}

                        {item.mrp > item.retailPrice &&
                          item.retailPrice > 0 && (
                            <span className="text-xs text-gray-400 line-through">
                              {formatPrice(item.mrp)}
                            </span>
                          )}
                      </div>

                      {detailUrl ? (
                        <Link
                          href={detailUrl}
                          className="mt-4 block rounded-lg bg-black px-3 py-2.5 text-center text-xs font-bold text-white hover:bg-gray-800"
                        >
                          View Product
                        </Link>
                      ) : (
                        <p className="mt-3 text-xs text-gray-500">
                          Product link unavailable
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => void removeItem(item)}
                        disabled={removingId === item.id}
                        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                      >
                        {removingId === item.id
                          ? "Removing..."
                          : "Remove from Wishlist"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/products"
                className="inline-flex rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold hover:border-black"
              >
                Continue Shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
