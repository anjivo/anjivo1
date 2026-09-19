"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  getCart,
  removeFromCart,
  updateCartItem,
  type Cart,
  type CartItem,
} from "@/lib/cart";

export default function CartPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.replace("/login");
          return;
        }

        setUser(currentUser);

        try {
          const customerCart = await getCart(currentUser.uid);
          setCart(customerCart);
        } catch (error) {
          console.error("Failed to load cart:", error);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  const subtotal = useMemo(() => {
    if (!cart) return 0;

    return cart.items.reduce(
      (total, item) =>
        total + item.selectedPrice * item.quantity,
      0
    );
  }, [cart]);

  const totalItems = useMemo(() => {
    if (!cart) return 0;

    return cart.items.reduce(
      (total, item) => total + item.quantity,
      0
    );
  }, [cart]);

  async function changeQuantity(
    item: CartItem,
    newQuantity: number
  ) {
    if (!user || !cart) return;

    if (newQuantity < 1) return;

    if (newQuantity > item.stock) {
      return;
    }

    const key = `${item.productId}-${item.pricingType}`;

    try {
      setUpdating(key);

      await updateCartItem(
        user.uid,
        item.productId,
        item.pricingType,
        newQuantity
      );

      const updatedCart = await getCart(user.uid);

      setCart(updatedCart);
    } catch (error) {
      console.error(
        "Failed to update cart:",
        error
      );
    } finally {
      setUpdating(null);
    }
  }

  async function removeItem(item: CartItem) {
    if (!user) return;

    const key = `${item.productId}-${item.pricingType}`;

    try {
      setUpdating(key);

      await removeFromCart(
        user.uid,
        item.productId,
        item.pricingType
      );

      const updatedCart = await getCart(user.uid);

      setCart(updatedCart);
    } catch (error) {
      console.error(
        "Failed to remove cart item:",
        error
      );
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <CartHeader />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-3xl">⏳</div>

            <p className="mt-3 text-sm font-semibold text-gray-500">
              Loading your cart...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
        <CartHeader />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <div className="text-6xl">🛒</div>

            <h1 className="mt-5 text-2xl font-black">
              Your cart is empty
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Add products to your cart and they will
              appear here.
            </p>

            <Link
              href="/products"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3.5 text-sm font-bold text-white transition hover:bg-gray-800"
            >
              Start Shopping
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
      <CartHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">

        {/* ================= TITLE ================= */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            ANJIVO
          </p>

          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Shopping Cart
          </h1>

          <p className="mt-1 text-xs text-gray-500">
            {totalItems} item
            {totalItems !== 1 ? "s" : ""} in your cart
          </p>
        </div>

        {/* ================= CART ================= */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">

          {/* ITEMS */}
          <div className="space-y-3">

            {cart.items.map((item) => {
              const key = `${item.productId}-${item.pricingType}`;

              return (
                <CartItemCard
                  key={key}
                  item={item}
                  updating={updating === key}
                  onIncrease={() =>
                    changeQuantity(
                      item,
                      item.quantity + 1
                    )
                  }
                  onDecrease={() =>
                    changeQuantity(
                      item,
                      item.quantity - 1
                    )
                  }
                  onRemove={() =>
                    removeItem(item)
                  }
                />
              );
            })}

            <Link
              href="/products"
              className="inline-flex rounded-xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold transition hover:border-black"
            >
              ← Continue Shopping
            </Link>
          </div>

          {/* SUMMARY */}
          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 lg:sticky lg:top-28">

            <h2 className="text-lg font-black">
              Order Summary
            </h2>

            <div className="mt-5 space-y-3 border-b border-gray-100 pb-5">

              <SummaryRow
                label={`Items (${totalItems})`}
                value={`₹${subtotal.toLocaleString("en-IN")}`}
              />

              <SummaryRow
                label="Shipping"
                value="Calculated at checkout"
              />

            </div>

            <div className="flex items-center justify-between pt-5">
              <span className="text-sm font-bold">
                Total
              </span>

              <span className="text-2xl font-black">
                ₹{subtotal.toLocaleString("en-IN")}
              </span>
            </div>

            <button
              type="button"
              onClick={() => router.push("/checkout")}
              className="mt-5 w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800"
            >
              Proceed to Checkout →
            </button>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
              <TrustItem
                icon="🔒"
                text="Secure"
              />

              <TrustItem
                icon="✓"
                text="Verified"
              />

              <TrustItem
                icon="📦"
                text="Tracked"
              />
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}


/* =========================================
   CART HEADER
========================================= */

function CartHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

        <Link
          href="/"
          className="relative block h-14 w-32"
          aria-label="ANJIVO Home"
        >
          <Image
            src="/logo/anjivo-logo.png"
            alt="ANJIVO"
            fill
            priority
            sizes="128px"
            className="object-contain object-left"
          />
        </Link>

        <Link
          href="/account"
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold transition hover:border-black"
        >
          My Account
        </Link>

      </div>
    </header>
  );
}


/* =========================================
   CART ITEM
========================================= */

function CartItemCard({
  item,
  updating,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItem;
  updating: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">

      <div className="flex gap-4">

        {/* IMAGE */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-28 sm:w-28">

          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="112px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">
              📦
            </div>
          )}

        </div>

        {/* DETAILS */}
        <div className="min-w-0 flex-1">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">

              <Link
                href={`/products/${item.slug}`}
                className="line-clamp-2 text-sm font-black hover:underline"
              >
                {item.name}
              </Link>

              {item.sellerName && (
                <p className="mt-1 truncate text-[10px] text-gray-400">
                  Sold by {item.sellerName}
                </p>
              )}

            </div>

            <button
              type="button"
              onClick={onRemove}
              disabled={updating}
              className="shrink-0 text-xs font-bold text-gray-400 transition hover:text-black disabled:opacity-50"
            >
              Remove
            </button>

          </div>

          {/* PRICING TYPE */}
          <div className="mt-2">

            <span className="rounded-lg bg-gray-100 px-2 py-1 text-[9px] font-black uppercase">
              {item.pricingType}
            </span>

            {item.pricingType === "wholesale" && (
              <span className="ml-2 text-[10px] text-gray-400">
                MOQ {item.moq}
              </span>
            )}

          </div>

          {/* PRICE + QUANTITY */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <div>
              <p className="text-lg font-black">
                ₹{item.selectedPrice.toLocaleString("en-IN")}
              </p>

              <p className="text-[9px] text-gray-400">
                / piece
              </p>
            </div>

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={onDecrease}
                disabled={
                  updating || item.quantity <= 1
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-sm font-bold disabled:opacity-40"
              >
                −
              </button>

              <span className="min-w-7 text-center text-sm font-black">
                {item.quantity}
              </span>

              <button
                type="button"
                onClick={onIncrease}
                disabled={
                  updating ||
                  item.quantity >= item.stock
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-sm font-bold disabled:opacity-40"
              >
                +
              </button>

            </div>

            <div className="text-right">
              <p className="text-sm font-black">
                ₹
                {(
                  item.selectedPrice *
                  item.quantity
                ).toLocaleString("en-IN")}
              </p>

              <p className="text-[9px] text-gray-400">
                {item.stock} available
              </p>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}


/* =========================================
   SUMMARY ROW
========================================= */

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-gray-500">
        {label}
      </span>

      <span className="text-xs font-bold text-gray-800">
        {value}
      </span>
    </div>
  );
}


/* =========================================
   TRUST
========================================= */

function TrustItem({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <div className="text-center">
      <div className="text-sm">{icon}</div>

      <p className="mt-1 text-[9px] font-bold text-gray-500">
        {text}
      </p>
    </div>
  );
}
