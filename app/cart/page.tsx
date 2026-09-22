"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth } from "@/lib/firebase";

import {
  getCart,
  updateCartQuantity,
  removeFromCart,
  groupCartBySeller,
  getCartSubtotal,
  getCartItemPieceQuantity,
  type Cart,
  type CartItem,
} from "@/lib/cart";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getItemKey(item: CartItem) {
  return [
    item.sellerId,
    item.id,
    item.pricingType,
    item.wholesaleUnit || "NONE",
    item.piecesPerSet || 0,
    item.setName || "",
  ].join("-");
}

function getUnitLabel(item: CartItem) {
  if (
    item.pricingType === "wholesale" &&
    item.wholesaleUnit === "SET"
  ) {
    return "Set";
  }

  return "Piece";
}

function getUnitLabelPlural(item: CartItem) {
  if (
    item.pricingType === "wholesale" &&
    item.wholesaleUnit === "SET"
  ) {
    return item.quantity === 1
      ? "Set"
      : "Sets";
  }

  return item.quantity === 1
    ? "Piece"
    : "Pieces";
}

function isSetItem(item: CartItem) {
  return (
    item.pricingType === "wholesale" &&
    item.wholesaleUnit === "SET" &&
    Boolean(item.isSet)
  );
}

export default function CartPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [cart, setCart] =
    useState<Cart | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [updating, setUpdating] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  /* =======================================================
     AUTH + LOAD CART
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/cart"
            );
            return;
          }

          try {
            setLoading(true);
            setError("");

            setUserId(user.uid);

            const result =
              await getCart(user.uid);

            setCart(result);
          } catch (err) {
            console.error(
              "Cart loading error:",
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "Unable to load cart."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  /* =======================================================
     GROUP CART BY SELLER
  ======================================================= */

  const groups = useMemo(() => {
    if (!cart) {
      return [];
    }

    const grouped =
      groupCartBySeller(cart);

    return Object.entries(
      grouped
    ).map(
      ([sellerId, items]) => ({
        sellerId,
        sellerName:
          items[0]?.sellerName ||
          "ANJIVO Seller",
        items,
      })
    );
  }, [cart]);

  /* =======================================================
     SUBTOTAL
  ======================================================= */

  const subtotal = useMemo(() => {
    if (!cart) {
      return 0;
    }

    return getCartSubtotal(cart);
  }, [cart]);

  /* =======================================================
     TOTAL PIECES
  ======================================================= */

  const totalPieces = useMemo(() => {
    if (!cart) {
      return 0;
    }

    return cart.items.reduce(
      (total, item) =>
        total +
        getCartItemPieceQuantity(
          item
        ),
      0
    );
  }, [cart]);

  /* =======================================================
     CHANGE QUANTITY
  ======================================================= */

  async function changeQuantity(
    item: CartItem,
    quantity: number
  ) {
    if (!userId) {
      return;
    }

    const key =
      getItemKey(item);

    try {
      setUpdating(key);
      setError("");

      const updated =
        await updateCartQuantity(
          userId,
          item.id,
          item.sellerId,
          item.pricingType,
          quantity,
          {
            wholesaleUnit:
              item.wholesaleUnit,
            piecesPerSet:
              item.piecesPerSet,
            setName:
              item.setName,
          }
        );

      setCart(updated);
    } catch (err) {
      console.error(
        "Quantity update error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update quantity."
      );
    } finally {
      setUpdating(null);
    }
  }

  /* =======================================================
     REMOVE ITEM
  ======================================================= */

  async function removeItem(
    item: CartItem
  ) {
    if (!userId) {
      return;
    }

    const key =
      getItemKey(item);

    try {
      setUpdating(key);
      setError("");

      const updated =
        await removeFromCart(
          userId,
          item.id,
          item.sellerId,
          item.pricingType,
          {
            wholesaleUnit:
              item.wholesaleUnit,
            piecesPerSet:
              item.piecesPerSet,
            setName:
              item.setName,
          }
        );

      setCart(updated);
    } catch (err) {
      console.error(
        "Remove cart item error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove item."
      );
    } finally {
      setUpdating(null);
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-6xl px-4 py-12">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">
              🛒
            </div>

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading your cart...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =======================================================
     EMPTY CART
  ======================================================= */

  if (
    !cart ||
    cart.items.length === 0
  ) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-12">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center sm:p-16">
            <div className="text-6xl">
              🛒
            </div>

            <h1 className="mt-5 text-2xl font-black">
              Your cart is empty
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              Add products from different
              sellers and manage everything
              from one cart.
            </p>

            <Link
              href="/products"
              className="mt-7 inline-flex rounded-xl bg-black px-6 py-3 text-xs font-bold text-white"
            >
              Continue Shopping
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              ANJIVO Shopping
            </p>

            <h1 className="mt-2 text-3xl font-black">
              My Cart
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {cart.items.length} item
              {cart.items.length === 1
                ? ""
                : "s"}{" "}
              from {groups.length} seller
              {groups.length === 1
                ? ""
                : "s"}
            </p>
          </div>

          <Link
            href="/products"
            className="w-fit text-xs font-bold text-gray-500 hover:text-black"
          >
            ← Continue Shopping
          </Link>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* =================================================
            CONTENT
        ================================================= */}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_350px]">

          {/* =================================================
              CART ITEMS
          ================================================= */}

          <div className="space-y-5">

            {groups.map(
              (group) => (
                <section
                  key={
                    group.sellerId
                  }
                  className="overflow-hidden rounded-3xl border border-gray-200 bg-white"
                >

                  {/* SELLER HEADER */}

                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Seller
                      </p>

                      <p className="mt-1 text-sm font-black">
                        {group.sellerName}
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-gray-500">
                      {group.items.length} item
                      {group.items.length ===
                      1
                        ? ""
                        : "s"}
                    </span>
                  </div>

                  {/* ITEMS */}

                  <div className="divide-y divide-gray-100">

                    {group.items.map(
                      (item) => {
                        const key =
                          getItemKey(
                            item
                          );

                        const isUpdating =
                          updating ===
                          key;

                        const itemIsSet =
                          isSetItem(
                            item
                          );

                        const itemTotal =
                          item.selectedPrice *
                          item.quantity;

                        const actualPieces =
                          getCartItemPieceQuantity(
                            item
                          );

                        return (
                          <div
                            key={key}
                            className="p-5"
                          >

                            {/* PRODUCT */}

                            <div className="flex gap-4">

                              {/* IMAGE */}

                              <Link
                                href={`/products/${item.slug}`}
                                className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-100 sm:h-28 sm:w-28"
                              >
                                {item.image ? (
                                  <img
                                    src={
                                      item.image
                                    }
                                    alt={
                                      item.name
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-2xl">
                                    📦
                                  </div>
                                )}
                              </Link>

                              {/* INFO */}

                              <div className="min-w-0 flex-1">

                                <Link
                                  href={`/products/${item.slug}`}
                                  className="text-sm font-black hover:underline"
                                >
                                  {
                                    item.name
                                  }
                                </Link>

                                {/* BUYING TYPE */}

                                <div className="mt-1 flex flex-wrap items-center gap-2">

                                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-gray-600">
                                    {item.pricingType ===
                                    "wholesale"
                                      ? "Wholesale"
                                      : "Retail"}
                                  </span>

                                  {itemIsSet && (
                                    <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white">
                                      SET
                                    </span>
                                  )}

                                  {item.wholesaleUnit ===
                                    "PIECE" &&
                                    item.pricingType ===
                                      "wholesale" && (
                                      <span className="text-[9px] font-bold text-gray-400">
                                        Per Piece
                                      </span>
                                    )}

                                  {itemIsSet && (
                                    <span className="text-[9px] font-bold text-gray-400">
                                      Per Set
                                    </span>
                                  )}
                                </div>

                                {/* SET INFO */}

                                {itemIsSet && (
                                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">

                                    <div className="flex flex-wrap items-center justify-between gap-2">

                                      <div>
                                        <p className="text-[10px] font-black">
                                          {item.setName ||
                                            "Wholesale Set"}
                                        </p>

                                        <p className="mt-0.5 text-[9px] text-gray-500">
                                          1 Set ={" "}
                                          {
                                            item.piecesPerSet
                                          }{" "}
                                          Pieces
                                        </p>
                                      </div>

                                      {!item.setBreakAllowed && (
                                        <span className="rounded-full bg-white px-2 py-1 text-[8px] font-bold text-gray-600">
                                          🔒 Cannot Be Broken
                                        </span>
                                      )}
                                    </div>

                                    {Array.isArray(
                                      item.setComposition
                                    ) &&
                                      item
                                        .setComposition
                                        .length >
                                        0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {item.setComposition.map(
                                            (
                                              composition,
                                              index
                                            ) => (
                                              <span
                                                key={`${composition.value}-${index}`}
                                                className="rounded-md bg-white px-2 py-1 text-[8px] font-semibold text-gray-600"
                                              >
                                                {
                                                  composition.value
                                                }{" "}
                                                ×{" "}
                                                {
                                                  composition.quantity
                                                }
                                              </span>
                                            )
                                          )}
                                        </div>
                                      )}
                                  </div>
                                )}

                                {/* MOQ */}

                                {item.pricingType ===
                                  "wholesale" && (
                                  <p className="mt-2 text-[10px] font-semibold text-green-600">
                                    MOQ:{" "}
                                    {item.moq}{" "}
                                    {itemIsSet
                                      ? "sets"
                                      : "pieces"}
                                  </p>
                                )}

                                {/* PRICE */}

                                <div className="mt-3 flex flex-wrap items-center gap-3">

                                  <div>
                                    <p className="text-base font-black">
                                      {money(
                                        item.selectedPrice
                                      )}
                                    </p>

                                    <p className="text-[9px] font-semibold text-gray-400">
                                      per{" "}
                                      {getUnitLabel(
                                        item
                                      )}
                                    </p>
                                  </div>

                                  {item.mrp >
                                    item.selectedPrice && (
                                    <p className="text-xs text-gray-400 line-through">
                                      {money(
                                        item.mrp
                                      )}
                                    </p>
                                  )}

                                </div>

                              </div>

                              {/* REMOVE */}

                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(
                                    item
                                  )
                                }
                                disabled={
                                  isUpdating
                                }
                                className="self-start text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-40"
                              >
                                Remove
                              </button>

                            </div>

                            {/* QUANTITY */}

                            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                              <div className="flex flex-wrap items-center gap-3">

                                <span className="text-xs font-bold text-gray-500">
                                  Quantity
                                </span>

                                <div className="flex items-center overflow-hidden rounded-xl border border-gray-200">

                                  {/* MINUS */}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeQuantity(
                                        item,
                                        item.quantity -
                                          1
                                      )
                                    }
                                    disabled={
                                      isUpdating ||
                                      item.quantity <=
                                        1
                                    }
                                    className="h-9 w-9 text-sm font-black hover:bg-gray-50 disabled:opacity-30"
                                  >
                                    −
                                  </button>

                                  {/* CURRENT */}

                                  <span className="flex h-9 min-w-12 items-center justify-center border-x border-gray-200 px-2 text-xs font-black">
                                    {
                                      item.quantity
                                    }
                                  </span>

                                  {/* PLUS */}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeQuantity(
                                        item,
                                        item.quantity +
                                          1
                                      )
                                    }
                                    disabled={
                                      isUpdating ||
                                      (
                                        item.stock >
                                          0 &&
                                        item.quantity >=
                                          item.stock
                                      )
                                    }
                                    className="h-9 w-9 text-sm font-black hover:bg-gray-50 disabled:opacity-30"
                                  >
                                    +
                                  </button>

                                </div>

                                <span className="text-[10px] font-bold text-gray-500">
                                  {
                                    getUnitLabelPlural(
                                      item
                                    )
                                  }
                                </span>

                                {item.stock >
                                  0 && (
                                  <span className="text-[10px] text-gray-400">
                                    {item.stock}{" "}
                                    available
                                  </span>
                                )}

                              </div>

                              {/* SET PIECE REPRESENTATION */}

                              {itemIsSet && (
                                <div className="rounded-xl bg-gray-50 px-3 py-2 text-right">
                                  <p className="text-[9px] text-gray-400">
                                    Total pieces
                                    represented
                                  </p>

                                  <p className="text-xs font-black">
                                    {
                                      actualPieces
                                    }{" "}
                                    pieces
                                  </p>
                                </div>
                              )}

                              {/* ITEM TOTAL */}

                              <div className="text-right">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                                  Item Total
                                </p>

                                <p className="text-sm font-black">
                                  {money(
                                    itemTotal
                                  )}
                                </p>
                              </div>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>
                </section>
              )
            )}

          </div>

          {/* =================================================
              SUMMARY
          ================================================= */}

          <aside className="lg:sticky lg:top-24 lg:h-fit">

            <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <h2 className="text-lg font-black">
                Order Summary
              </h2>

              <div className="mt-5 space-y-3">

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    Cart Lines
                  </span>

                  <span className="font-bold">
                    {cart.items.length}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    Sellers
                  </span>

                  <span className="font-bold">
                    {groups.length}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    Total Pieces
                  </span>

                  <span className="font-bold">
                    {totalPieces}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    Subtotal
                  </span>

                  <span className="font-bold">
                    {money(
                      subtotal
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    Shipping
                  </span>

                  <span className="font-bold text-green-600">
                    Calculated at checkout
                  </span>
                </div>

              </div>

              <div className="my-5 border-t border-gray-100" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-black">
                  Total
                </span>

                <span className="text-xl font-black">
                  {money(
                    subtotal
                  )}
                </span>
              </div>

              <Link
                href="/checkout"
                className="mt-6 block rounded-xl bg-black px-5 py-4 text-center text-sm font-bold text-white hover:bg-gray-800"
              >
                Proceed to Checkout
              </Link>

              <p className="mt-3 text-center text-[10px] leading-4 text-gray-400">
                Final shipping charges and
                order details will be shown
                before payment.
              </p>

            </div>

            {/* SET EXPLANATION */}

            {cart.items.some(
              (item) =>
                isSetItem(item)
            ) && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-black">
                  📦 Wholesale Set
                  Information
                </p>

                <p className="mt-2 text-[10px] leading-4 text-gray-500">
                  Set quantities are counted
                  separately from individual
                  pieces. A set cannot be
                  broken when the seller has
                  configured it as a complete
                  set.
                </p>
              </div>
            )}

            {/* SECURITY */}

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-black">
                🛡 Secure Shopping
              </p>

              <p className="mt-1 text-[10px] leading-4 text-gray-500">
                Your cart can contain products
                from multiple ANJIVO sellers.
              </p>
            </div>

          </aside>

        </div>
      </main>

      <Footer />
    </div>
  );
}
