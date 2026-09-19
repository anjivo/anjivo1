"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth } from "@/lib/firebase";
import {
  getCart,
  clearCart,
  type CartItem,
} from "@/lib/cart";
import {
  createOrder,
  type ShippingAddress,
} from "@/lib/orders";

export default function CheckoutPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<User | null>(null);

  const [items, setItems] =
    useState<CartItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<"COD" | "ONLINE">("COD");

  const [address, setAddress] =
    useState<ShippingAddress>({
      fullName: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
    });

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          setUser(currentUser);

          if (!currentUser) {
            router.replace(
              "/login?redirect=/checkout"
            );
            return;
          }

          try {
            const cart = await getCart(
              currentUser.uid
            );

            setItems(cart.items);
          } catch (err) {
            console.error(err);

            setError(
              "Unable to load your cart."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  const subtotal = useMemo(() => {
    return items.reduce(
      (total, item) =>
        total +
        item.selectedPrice *
          item.quantity,
      0
    );
  }, [items]);

  const totalQuantity = useMemo(() => {
    return items.reduce(
      (total, item) =>
        total + item.quantity,
      0
    );
  }, [items]);

  function updateAddress(
    field: keyof ShippingAddress,
    value: string
  ) {
    setAddress((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function validateAddress() {
    if (!address.fullName.trim()) {
      return "Please enter your full name.";
    }

    if (
      !/^[6-9]\d{9}$/.test(
        address.phone.trim()
      )
    ) {
      return "Please enter a valid 10-digit mobile number.";
    }

    if (!address.addressLine1.trim()) {
      return "Please enter your address.";
    }

    if (!address.city.trim()) {
      return "Please enter your city.";
    }

    if (!address.state.trim()) {
      return "Please enter your state.";
    }

    if (
      !/^\d{6}$/.test(
        address.pincode.trim()
      )
    ) {
      return "Please enter a valid 6-digit pincode.";
    }

    return "";
  }

  async function handlePlaceOrder() {
    if (!user) {
      router.push(
        "/login?redirect=/checkout"
      );
      return;
    }

    if (items.length === 0) {
      setError(
        "Your cart is empty."
      );
      return;
    }

    const validationError =
      validateAddress();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setPlacingOrder(true);
      setError("");
      setSuccess("");

      const orderId =
        await createOrder({
          userId: user.uid,
          items,
          shippingAddress: {
            fullName:
              address.fullName.trim(),

            phone:
              address.phone.trim(),

            addressLine1:
              address.addressLine1.trim(),

            addressLine2:
              address.addressLine2?.trim() ||
              "",

            city:
              address.city.trim(),

            state:
              address.state.trim(),

            pincode:
              address.pincode.trim(),
          },

          paymentMethod,
        });

      await clearCart(user.uid);

      setSuccess(
        "Order placed successfully."
      );

      setTimeout(() => {
        router.push(
          `/account/orders/${orderId}`
        );
      }, 700);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to place order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-3xl">
              ⏳
            </div>

            <p className="mt-3 text-sm font-semibold text-gray-500">
              Loading checkout...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-5xl">
              🛒
            </div>

            <h1 className="mt-4 text-2xl font-black">
              Your cart is empty
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Add some products before checkout.
            </p>

            <Link
              href="/products"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white"
            >
              Continue Shopping
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">
        {/* HEADER */}
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            ANJIVO Checkout
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Complete Your Order
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Enter delivery details and choose your payment method.
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* LEFT */}
          <div className="space-y-5">
            {/* ADDRESS */}
            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                  📍
                </div>

                <div>
                  <h2 className="text-lg font-black">
                    Delivery Address
                  </h2>

                  <p className="text-xs text-gray-400">
                    Where should we deliver your order?
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* FULL NAME */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Full Name *
                  </label>

                  <input
                    type="text"
                    value={address.fullName}
                    onChange={(e) =>
                      updateAddress(
                        "fullName",
                        e.target.value
                      )
                    }
                    placeholder="Enter full name"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                {/* PHONE */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Mobile Number *
                  </label>

                  <input
                    type="tel"
                    value={address.phone}
                    maxLength={10}
                    onChange={(e) =>
                      updateAddress(
                        "phone",
                        e.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    placeholder="10-digit mobile"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                {/* ADDRESS */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold">
                    Address *
                  </label>

                  <textarea
                    value={
                      address.addressLine1
                    }
                    onChange={(e) =>
                      updateAddress(
                        "addressLine1",
                        e.target.value
                      )
                    }
                    placeholder="House / Shop / Street / Area"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                {/* LANDMARK */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold">
                    Landmark
                    <span className="ml-1 font-normal text-gray-400">
                      (Optional)
                    </span>
                  </label>

                  <input
                    type="text"
                    value={
                      address.addressLine2
                    }
                    onChange={(e) =>
                      updateAddress(
                        "addressLine2",
                        e.target.value
                      )
                    }
                    placeholder="Nearby landmark"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                {/* CITY */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    City *
                  </label>

                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) =>
                      updateAddress(
                        "city",
                        e.target.value
                      )
                    }
                    placeholder="City"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                {/* STATE */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    State *
                  </label>

                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) =>
                      updateAddress(
                        "state",
                        e.target.value
                      )
                    }
                    placeholder="State"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                {/* PINCODE */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Pincode *
                  </label>

                  <input
                    type="text"
                    value={address.pincode}
                    maxLength={6}
                    onChange={(e) =>
                      updateAddress(
                        "pincode",
                        e.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    placeholder="6-digit pincode"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
              </div>
            </section>

            {/* PAYMENT */}
            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
              <h2 className="text-lg font-black">
                Payment Method
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Choose how you want to pay.
              </p>

              <div className="mt-5 space-y-3">
                {/* COD */}
                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod("COD")
                  }
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                    paymentMethod === "COD"
                      ? "border-black bg-gray-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl">
                      💵
                    </div>

                    <div>
                      <p className="text-sm font-black">
                        Cash on Delivery
                      </p>

                      <p className="mt-0.5 text-[10px] text-gray-400">
                        Pay when your order arrives
                      </p>
                    </div>
                  </div>

                  <div
                    className={`h-5 w-5 rounded-full border-2 ${
                      paymentMethod === "COD"
                        ? "border-black bg-black"
                        : "border-gray-300"
                    }`}
                  />
                </button>

                {/* ONLINE */}
                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod("ONLINE")
                  }
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                    paymentMethod === "ONLINE"
                      ? "border-black bg-gray-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl">
                      💳
                    </div>

                    <div>
                      <p className="text-sm font-black">
                        Online Payment
                      </p>

                      <p className="mt-0.5 text-[10px] text-gray-400">
                        UPI / Card / Net Banking
                      </p>
                    </div>
                  </div>

                  <div
                    className={`h-5 w-5 rounded-full border-2 ${
                      paymentMethod === "ONLINE"
                        ? "border-black bg-black"
                        : "border-gray-300"
                    }`}
                  />
                </button>
              </div>

              {paymentMethod === "ONLINE" && (
                <div className="mt-4 rounded-xl bg-yellow-50 px-4 py-3 text-xs font-semibold text-yellow-800">
                  Online payment gateway will be connected in the next payment integration step.
                </div>
              )}
            </section>

            {/* ITEMS */}
            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">
                  Order Items
                </h2>

                <span className="text-xs font-bold text-gray-400">
                  {totalQuantity} items
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {items.map((item) => (
                  <div
                    key={`${item.productId}-${item.pricingType}`}
                    className="flex gap-3 rounded-2xl border border-gray-100 p-3"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          📦
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {item.name}
                      </p>

                      <p className="mt-1 text-[10px] uppercase text-gray-400">
                        {item.pricingType}
                      </p>

                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Qty:{" "}
                          {item.quantity}
                        </span>

                        <span className="text-sm font-black">
                          ₹
                          {(
                            item.selectedPrice *
                            item.quantity
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* RIGHT */}
          <aside>
            <div className="sticky top-24 rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-black">
                Order Summary
              </h2>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Items
                  </span>

                  <span className="font-semibold">
                    {totalQuantity}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Subtotal
                  </span>

                  <span className="font-semibold">
                    ₹
                    {subtotal.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Delivery
                  </span>

                  <span className="font-bold">
                    FREE
                  </span>
                </div>
              </div>

              <div className="my-5 border-t border-gray-100" />

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-400">
                    Total Amount
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    ₹
                    {subtotal.toLocaleString(
                      "en-IN"
                    )}
                  </p>
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-[9px] font-bold">
                  {paymentMethod}
                </span>
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={placingOrder}
                className="mt-6 w-full rounded-2xl bg-black py-4 text-sm font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {placingOrder
                  ? "Placing Order..."
                  : paymentMethod === "COD"
                    ? "Place Order"
                    : "Continue to Payment"}
              </button>

              <p className="mt-4 text-center text-[9px] leading-4 text-gray-400">
                By placing this order, you agree to ANJIVO's terms and policies.
              </p>

              <Link
                href="/cart"
                className="mt-4 block text-center text-xs font-bold text-gray-500 hover:text-black"
              >
                ← Back to Cart
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
