
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type WishlistProduct = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  images?: string[];
  retailPrice?: number;
  mrp?: number;
};

type Props = {
  product: WishlistProduct;
  className?: string;
  showLabel?: boolean;
};

export default function AddToWishlistButton({
  product,
  className = "",
  showLabel = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUserId(user?.uid ?? null);

      if (!user || !product.id) {
        setSaved(false);
        setChecking(false);
        return;
      }

      setChecking(true);

      try {
        const itemRef = doc(
          db,
          "wishlists",
          user.uid,
          "items",
          product.id
        );

        const snapshot = await getDoc(itemRef);
        setSaved(snapshot.exists());
      } catch (error) {
        console.error("Check wishlist failed:", error);
        setMessage("Wishlist status check nahi ho saka.");
      } finally {
        setChecking(false);
      }
    });

    return unsubscribe;
  }, [product.id]);

  async function toggleWishlist() {
    if (loading || checking) return;

    const user = auth.currentUser;

    if (!user) {
      router.push(
        `/login?redirect=${encodeURIComponent(pathname || "/products")}`
      );
      return;
    }

    if (!product.id || !product.slug) {
      setMessage("Product details incomplete hain.");
      return;
    }

    setLoading(true);
    setMessage("");

    const itemRef = doc(
      db,
      "wishlists",
      user.uid,
      "items",
      product.id
    );

    try {
      if (saved) {
        await deleteDoc(itemRef);
        setSaved(false);
        setMessage("Wishlist se remove ho gaya.");
      } else {
        await setDoc(itemRef, {
          productId: product.id,
          name: product.name,
          slug: product.slug,
          image: product.image || product.images?.[0] || "",
          retailPrice: Number(product.retailPrice || 0),
          mrp: Number(product.mrp || 0),
          createdAt: serverTimestamp(),
        });

        setSaved(true);
        setMessage("Wishlist mein save ho gaya.");
      }
    } catch (error) {
      console.error("Update wishlist failed:", error);
      setMessage(
        "Wishlist update nahi hui. Login aur Firestore permissions check karein."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => void toggleWishlist()}
        disabled={loading || checking}
        aria-label={
          saved ? "Remove from wishlist" : "Add to wishlist"
        }
        aria-pressed={saved}
        title={saved ? "Remove from wishlist" : "Add to wishlist"}
        className={`inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {loading || checking ? "…" : saved ? "♥" : "♡"}
        </span>

        {showLabel && (
          <span className="text-sm font-semibold">
            {saved ? "Saved" : "Add to Wishlist"}
          </span>
        )}
      </button>

      {message && (
        <span role="status" className="mt-1 max-w-52 text-xs text-gray-600">
          {message}
        </span>
      )}
    </div>
  );
}
