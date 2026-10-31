"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  getCart,
  groupCartBySeller,
  getCartItemPieceQuantity,
  getCartItemTotal,
  getEffectiveCartItemPrice,
} from "@/lib/cart";
import type { ShippingAddress } from "@/lib/orders";
import type { Cart } from "@/lib/cart";

type PaymentMethod = "COD" | "ONLINE";
type AddressLabel = "Home" | "Work" | "Other";
type SavedAddress = ShippingAddress & {
  id: string;
  label: AddressLabel;
  isDefault: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type FormErrors = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export default function CheckoutPage() {
  const [userId, setUserId] = useState("");
  const [cart, setCart] = useState<Cart | null>(null);

  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] =
    useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("COD");

  const [error, setError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(true);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressLabel, setAddressLabel] = useState<AddressLabel>("Home");
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState("");

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
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setUserId("");
          setCart(null);
          setLoading(false);
          return;
        }

        setUserId(user.uid);

        try {
          const currentCart = await getCart(user.uid);
          setCart(currentCart);
          setAddress((current) => ({
            ...current,
            fullName: current.fullName || user.displayName || "",
          }));

          setAddressesLoading(true);
          try {
            const token = await user.getIdToken();
            const response = await fetch("/api/account/addresses", {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
              throw new Error(result.message || "Unable to load saved addresses.");
            }

            const addresses = Array.isArray(result.addresses)
              ? (result.addresses as SavedAddress[])
              : [];
            setSavedAddresses(addresses);
            const preferred = addresses.find((item) => item.isDefault) || addresses[0];
            if (preferred) {
              setSelectedAddressId(preferred.id);
              setAddress({
                fullName: preferred.fullName,
                phone: preferred.phone,
                addressLine1: preferred.addressLine1,
                addressLine2: preferred.addressLine2 || "",
                city: preferred.city,
                state: preferred.state,
                pincode: preferred.pincode,
              });
              setAddressLabel(preferred.label || "Home");
              setShowAddressForm(false);
            }
          } catch (addressError) {
            // Checkout remains usable with a manually entered address if saved-address loading fails.
            console.error("Saved addresses could not be loaded:", addressError);
          } finally {
            setAddressesLoading(false);
          }
        } catch (err) {
          console.error(err);
          setError("Unable to load your cart.");
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const sellerGroups = useMemo(() => {
    if (!cart) return [];

    return Object.entries(
      groupCartBySeller(cart)
    );
  }, [cart]);

  // Always calculate checkout totals from the current cart lines.
  // This keeps combined size/colour wholesale tiers consistent with /cart.
  const subtotal = cart
    ? cart.items.reduce(
        (sum, item) =>
          sum + getCartItemTotal(item, cart.items),
        0
      )
    : 0;
  const shippingCharge = 0;
  // Online payment is not active yet; COD has no prepaid discount.
  const discount = 0;
  const total = Math.max(0, subtotal + shippingCharge - discount);

  function updateAddress(
    field: keyof ShippingAddress,
    value: string
  ) {
    setAddress((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));

    setError("");
  }

  function selectSavedAddress(saved: SavedAddress) {
    setSelectedAddressId(saved.id);
    setEditingAddressId("");
    setAddressLabel(saved.label || "Home");
    setAddress({
      fullName: saved.fullName,
      phone: saved.phone,
      addressLine1: saved.addressLine1,
      addressLine2: saved.addressLine2 || "",
      city: saved.city,
      state: saved.state,
      pincode: saved.pincode,
    });
    setErrors({});
    setError("");
    setShowAddressForm(false);
  }

  function startNewAddress() {
    setSelectedAddressId("");
    setEditingAddressId("");
    setAddressLabel("Home");
    setAddress({
      fullName: auth.currentUser?.displayName || "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
    });
    setErrors({});
    setError("");
    setShowAddressForm(true);
  }

  function startEditAddress(saved: SavedAddress) {
    selectSavedAddress(saved);
    setEditingAddressId(saved.id);
    setShowAddressForm(true);
  }

  async function saveAddress() {
    if (savingAddress || !validateAddress()) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Please log in again to save your address.");
      return;
    }

    try {
      setSavingAddress(true);
      setError("");
      const token = await currentUser.getIdToken();
      const payload = {
        ...address,
        label: addressLabel,
        isDefault: true,
        ...(editingAddressId ? { id: editingAddressId } : {}),
      };
      const response = await fetch("/api/account/addresses", {
        method: editingAddressId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.address) {
        throw new Error(result.message || "Unable to save this address.");
      }

      const saved = result.address as SavedAddress;
      setSavedAddresses((current) => {
        const next = current
          .filter((item) => item.id !== saved.id)
          .map((item) => ({ ...item, isDefault: false }));
        return [saved, ...next];
      });
      selectSavedAddress(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this address.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function deleteAddress(id: string) {
    if (deletingAddressId) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Please log in again to manage saved addresses.");
      return;
    }
    if (!window.confirm("Delete this saved address?")) return;

    try {
      setDeletingAddressId(id);
      setError("");
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/account/addresses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to delete this address.");
      }

      const remaining = savedAddresses.filter((item) => item.id !== id);
      setSavedAddresses(remaining);
      if (selectedAddressId === id || editingAddressId === id) {
        const replacement = remaining.find((item) => item.isDefault) || remaining[0];
        if (replacement) {
          selectSavedAddress(replacement);
        } else {
          startNewAddress();
        }
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this address.");
    } finally {
      setDeletingAddressId("");
    }
  }

  function validateAddress(): boolean {
    const nextErrors: FormErrors = {};

    if (address.fullName.trim().length < 2) {
      nextErrors.fullName =
        "Enter your full name.";
    }

    if (!/^[6-9]\d{9}$/.test(address.phone.trim())) {
      nextErrors.phone =
        "Enter a valid 10 digit mobile number.";
    }

    if (
      address.addressLine1.trim().length < 5
    ) {
      nextErrors.addressLine1 =
        "Enter your complete address.";
    }

    if (address.city.trim().length < 2) {
      nextErrors.city =
        "Enter your city.";
    }

    if (address.state.trim().length < 2) {
      nextErrors.state =
        "Enter your state.";
    }

    if (!/^\d{6}$/.test(address.pincode.trim())) {
      nextErrors.pincode =
        "Enter a valid 6 digit pincode.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function placeOrder() {
    if (placingOrder) return;

    if (!userId) {
      setError("Please login before placing your order.");
      return;
    }

    if (!cart || cart.items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!validateAddress()) return;

    // Defense in depth: this checkout currently accepts COD only.
    if (paymentMethod !== "COD") {
      setError("Online payment is coming soon. Please select Cash on Delivery.");
      return;
    }

    try {
      setPlacingOrder(true);
      setError("");

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Your login session has expired. Please login again.");
      }

      const idToken = await currentUser.getIdToken();
      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      };

      const requestedItems = cart.items.map((item) => ({
        id: item.id,
        productId: item.id,
        sellerId: item.sellerId,
        quantity: item.quantity,
        pricingType: item.pricingType,
        wholesaleUnit: item.wholesaleUnit,
        piecesPerSet: item.piecesPerSet,
        setName: item.setName,
        setBreakAllowed: item.setBreakAllowed,
        variantId: item.variantId,
        variantSku: item.variantSku,
        variantName: item.variantName,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
        selectedVariantValue: item.selectedVariantValue,
      }));

      // Revalidate every item, combined-variant wholesale price, MOQ and stock on the server.
      const validationResponse = await fetch("/api/checkout/validate", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ items: requestedItems }),
        cache: "no-store",
      });
      const validationResult = await validationResponse.json();

      if (!validationResponse.ok || !validationResult.success) {
        const validationErrors = Array.isArray(validationResult.errors)
          ? validationResult.errors
          : [];
        const details = validationErrors
          .map((item: { message?: string }) => item.message || "Cart validation failed.")
          .join(" ");
        throw new Error(
          details || validationResult.message || "Unable to validate your cart."
        );
      }

      const validatedItems = Array.isArray(validationResult.items)
        ? validationResult.items
        : [];
      if (validatedItems.length === 0) {
        throw new Error("No valid items were found for this order.");
      }

      const orderItems = validatedItems.map((item: {
        productId?: string;
        id?: string;
        sellerId: string;
        quantity: number;
        pricingType: "retail" | "wholesale";
        wholesaleUnit?: "PIECE" | "SET";
        piecesPerSet?: number;
        setName?: string;
        setBreakAllowed?: boolean;
        variantId?: string;
        variantSku?: string;
        variantName?: string;
        selectedSize?: string;
        selectedColor?: string;
        selectedVariantValue?: string;
      }) => ({
        productId: item.productId || item.id || "",
        sellerId: item.sellerId,
        quantity: item.quantity,
        pricingType: item.pricingType,
        wholesaleUnit: item.wholesaleUnit,
        piecesPerSet: item.piecesPerSet,
        setName: item.setName,
        setBreakAllowed: item.setBreakAllowed,
        variantId: item.variantId,
        variantSku: item.variantSku,
        variantName: item.variantName,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
        selectedVariantValue: item.selectedVariantValue,
      }));

      // COD is the only enabled payment method for the current launch.
      const orderResponse = await fetch("/api/orders/create", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          shippingAddress: address,
          paymentMethod: "COD",
          items: orderItems,
        }),
        cache: "no-store",
      });
      const orderResult = await orderResponse.json();

      if (!orderResponse.ok || !orderResult.success) {
        throw new Error(orderResult.message || "Unable to create your order.");
      }
      if (!orderResult.orderId) {
        throw new Error("Order was created but order ID was not returned.");
      }

      // Clear the in-memory checkout cart before navigating to the success page.
      setCart(null);
      window.location.href = `/order-success/${orderResult.orderId}`;
    } catch (err) {
      console.error("Checkout error:", err);
      setError(
        err instanceof Error ? err.message : "Unable to place order."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border bg-white p-10 text-center">
            Loading checkout...
          </div>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-xl px-4 py-20">
          <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">
              🔐
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Login Required
            </h1>

            <p className="mt-2 text-slate-500">
              Please login to continue checkout.
            </p>

            <Link
              href="/login?redirect=/checkout"
              className="mt-6 inline-flex rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
            >
              Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-xl px-4 py-20">
          <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">🛒</div>

            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Your cart is empty
            </h1>

            <p className="mt-2 text-slate-500">
              Add products before proceeding to checkout.
            </p>

            <Link
              href="/products"
              className="mt-6 inline-flex rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}

        <div className="mb-8">
          <Link
            href="/cart"
            className="text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            ← Back to Cart
          </Link>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            Checkout
          </h1>

          <p className="mt-1 text-slate-500">
            Complete your delivery details and place your order.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_390px]">
          {/* LEFT */}

          <div className="space-y-6">
            {/* Saved Delivery Addresses */}
            <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">1. Delivery Address</h2>
                  <p className="mt-1 text-sm text-slate-500">Choose a saved address or add a new delivery address.</p>
                </div>
                <button
                  type="button"
                  onClick={startNewAddress}
                  disabled={placingOrder || savingAddress}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  + Add Address
                </button>
              </div>

              {addressesLoading && (
                <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Loading saved addresses...</p>
              )}

              {savedAddresses.length > 0 && (
                <div className="mb-6 grid gap-3">
                  {savedAddresses.map((saved) => {
                    const selected = selectedAddressId === saved.id && !showAddressForm;
                    return (
                      <div
                        key={saved.id}
                        className={`rounded-2xl border p-4 transition ${selected ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900" : "border-slate-200"}`}
                      >
                        <button
                          type="button"
                          onClick={() => selectSavedAddress(saved)}
                          disabled={placingOrder || savingAddress}
                          className="flex w-full items-start gap-3 text-left disabled:opacity-60"
                        >
                          <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-slate-900" : "border-slate-300"}`}>
                            {selected && <span className="h-2 w-2 rounded-full bg-slate-900" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900">{saved.fullName}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{saved.label || "Home"}</span>
                              {saved.isDefault && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Default</span>}
                            </span>
                            <span className="mt-1 block text-sm leading-6 text-slate-600">
                              {saved.addressLine1}{saved.addressLine2 ? `, ${saved.addressLine2}` : ""}, {saved.city}, {saved.state} - {saved.pincode}
                            </span>
                            <span className="mt-1 block text-sm text-slate-500">Mobile: {saved.phone}</span>
                          </span>
                        </button>
                        <div className="mt-3 flex gap-4 pl-7 text-sm font-semibold">
                          <button type="button" onClick={() => startEditAddress(saved)} disabled={placingOrder || savingAddress} className="text-slate-700 hover:text-black disabled:opacity-50">Edit</button>
                          <button type="button" onClick={() => void deleteAddress(saved.id)} disabled={placingOrder || !!deletingAddressId} className="text-red-600 hover:text-red-700 disabled:opacity-50">
                            {deletingAddressId === saved.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showAddressForm && (
                <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold text-slate-900">{editingAddressId ? "Edit Address" : "Add New Address"}</h3>
                    {savedAddresses.length > 0 && (
                      <button type="button" onClick={() => {
                        const selected = savedAddresses.find((item) => item.id === selectedAddressId);
                        if (selected) selectSavedAddress(selected);
                        else setShowAddressForm(false);
                      }} className="text-sm font-semibold text-slate-500 hover:text-slate-900">Cancel</button>
                    )}
                  </div>

                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Save address as</label>
                    <div className="flex flex-wrap gap-2">
                      {(["Home", "Work", "Other"] as AddressLabel[]).map((label) => (
                        <button key={label} type="button" onClick={() => setAddressLabel(label)} aria-pressed={addressLabel === label} className={`rounded-full border px-4 py-2 text-sm font-semibold ${addressLabel === label ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full Name" value={address.fullName} onChange={(value) => updateAddress("fullName", value)} error={errors.fullName} placeholder="Enter full name" />
                    <Field label="Mobile Number" value={address.phone} onChange={(value) => updateAddress("phone", value.replace(/\D/g, "").slice(0, 10))} error={errors.phone} placeholder="10 digit mobile number" type="tel" />
                    <div className="sm:col-span-2">
                      <Field label="Address Line 1" value={address.addressLine1} onChange={(value) => updateAddress("addressLine1", value)} error={errors.addressLine1} placeholder="House / Shop / Street / Area" />
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Address Line 2" value={address.addressLine2 || ""} onChange={(value) => updateAddress("addressLine2", value)} placeholder="Landmark / Area (optional)" />
                    </div>
                    <Field label="City" value={address.city} onChange={(value) => updateAddress("city", value)} error={errors.city} placeholder="City" />
                    <Field label="State" value={address.state} onChange={(value) => updateAddress("state", value)} error={errors.state} placeholder="State" />
                    <Field label="Pincode" value={address.pincode} onChange={(value) => updateAddress("pincode", value.replace(/\D/g, "").slice(0, 6))} error={errors.pincode} placeholder="6 digit pincode" />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => void saveAddress()} disabled={savingAddress || placingOrder} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                      {savingAddress ? "Saving Address..." : editingAddressId ? "Update Address" : "Save Address"}
                    </button>
                    <button type="button" onClick={() => {
                      const selected = savedAddresses.find((item) => item.id === selectedAddressId);
                      if (selected) selectSavedAddress(selected);
                      else setShowAddressForm(false);
                    }} disabled={savingAddress} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Use Without Saving</button>
                  </div>
                </div>
              )}

              {!showAddressForm && selectedAddressId && (
                <button type="button" onClick={() => {
                  const selected = savedAddresses.find((item) => item.id === selectedAddressId);
                  if (selected) startEditAddress(selected);
                }} className="text-sm font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900">Edit selected delivery details</button>
              )}
            </section>

            {/* Payment */}

            <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  2. Payment Method
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose how you want to pay.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("COD")}
                  disabled={placingOrder}
                  aria-pressed={paymentMethod === "COD"}
                  className={`rounded-2xl border-2 p-4 text-left transition ${paymentMethod === "COD" ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-lg text-white">₹</span>
                    <span>
                      <span className="block font-bold text-slate-900">Cash on Delivery</span>
                      <span className="mt-1 block text-xs text-slate-500">Pay when delivered</span>
                    </span>
                    <span className={`ml-auto h-4 w-4 rounded-full border-2 ${paymentMethod === "COD" ? "border-slate-900 bg-slate-900 ring-2 ring-slate-900 ring-offset-2" : "border-slate-300"}`} />
                  </div>
                </button>

                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="cursor-not-allowed rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-left opacity-75"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-slate-700">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 10h18M7 15h3" />
                      </svg>
                    </span>
                    <span>
                      <span className="block font-bold text-slate-700">Online Payment</span>
                      <span className="mt-1 block text-xs text-slate-500">UPI, cards and other methods</span>
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        Coming Soon
                      </span>
                    </span>
                    <span className="ml-auto text-xs font-semibold text-slate-400">Unavailable</span>
                  </div>
                </button>
              </div>

            </section>

            {/* Sellers */}

            <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  3. Order Items
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your cart may contain products from multiple sellers.
                </p>
              </div>

              <div className="space-y-5">
                {sellerGroups.map(
                  ([sellerId, items]) => (
                    <div
                      key={sellerId}
                      className="rounded-2xl border p-4"
                    >
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                          🏪
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Seller
                          </p>

                          <p className="font-bold text-slate-900">
                            {items[0]?.sellerName ||
                              "ANJIVO Seller"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {items.map((item) => (
                          <div
                            key={[
                              item.id,
                              item.pricingType,
                              item.wholesaleUnit || "",
                              item.piecesPerSet || "",
                              item.setName || "",
                              item.variantId || "",
                              item.selectedSize || "",
                              item.selectedColor || "",
                            ].join("-")}
                            className="flex gap-3"
                          >
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xl">
                                  📦
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                                {item.name}
                              </p>

                              {(item.variantName ||
                                item.selectedSize ||
                                item.selectedColor ||
                                item.selectedVariantValue ||
                                item.variantSku) && (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                  {item.variantName && (
                                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
                                      Variant: {item.variantName}
                                    </span>
                                  )}
                                  {item.selectedSize && (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                      Size: {item.selectedSize}
                                    </span>
                                  )}
                                  {item.selectedColor && (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                      Color: {item.selectedColor}
                                    </span>
                                  )}
                                  {item.selectedVariantValue && (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                      Option: {item.selectedVariantValue}
                                    </span>
                                  )}
                                  {item.variantSku && (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">
                                      SKU: {item.variantSku}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                                  {item.pricingType === "wholesale" && item.isSet
                                    ? `Qty: ${item.quantity} ${
                                        item.quantity === 1 ? "Set" : "Sets"
                                      }`
                                    : `Qty: ${item.quantity}`}
                                </span>

                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                                  {item.pricingType ===
                                  "wholesale"
                                    ? "Wholesale"
                                    : "Retail"}
                                </span>

                                {item.isSet && (
                                  <span className="rounded-full bg-slate-900 px-2 py-1 font-bold text-white">
                                    SET / PACK
                                  </span>
                                )}
                              </div>

                              {item.isSet && (
                                <div className="mt-2 rounded-xl bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-800">
                                  <p className="font-bold">
                                    {item.setName || "Complete Wholesale Set"}
                                  </p>
                                  <p>
                                    1 Set = {item.piecesPerSet || 1} pieces
                                    {" · "}
                                    Total pieces:{" "}
                                    {getCartItemPieceQuantity(item)}
                                  </p>
                                  {item.setBreakAllowed === false && (
                                    <p className="mt-1 font-bold">
                                      🔒 Complete set only — set cannot be broken.
                                    </p>
                                  )}
                                  {item.setComposition &&
                                    item.setComposition.length > 0 && (
                                      <p className="mt-1 text-amber-700">
                                        Composition:{" "}
                                        {item.setComposition
                                          .map(
                                            (component) =>
                                              `${component.value} × ${component.quantity}`
                                          )
                                          .join(", ")}
                                      </p>
                                    )}
                                </div>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="font-bold text-slate-900">
                                ₹
                                {getCartItemTotal(item, cart.items).toLocaleString(
                                  "en-IN"
                                )}
                              </p>

                              <p className="text-xs text-slate-500">
                                ₹
                                {getEffectiveCartItemPrice(cart.items, item).toLocaleString(
                                  "en-IN"
                                )}{" "}
                                {item.isSet ? "per set" : "each"}
                              </p>

                              {item.isSet && (
                                <p className="mt-1 text-[10px] text-slate-400">
                                  {getCartItemPieceQuantity(item)} pieces represented
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          </div>

          {/* RIGHT */}

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-bold text-slate-900">
                Order Summary
              </h2>

              <div className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Cart Lines
                  </span>

                  <span className="font-semibold text-slate-900">
                    {cart.items.length}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Total Units
                  </span>

                  <span className="font-semibold text-slate-900">
                    {cart.items.reduce(
                      (sum, item) => sum + item.quantity,
                      0
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Total Pieces
                  </span>

                  <span className="font-semibold text-slate-900">
                    {cart.items.reduce(
                      (sum, item) => sum + getCartItemPieceQuantity(item),
                      0
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Sellers
                  </span>

                  <span className="font-semibold text-slate-900">
                    {sellerGroups.length}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Subtotal
                  </span>

                  <span className="font-semibold text-slate-900">
                    ₹
                    {subtotal.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Shipping
                  </span>

                  <span className="font-semibold text-emerald-600">
                    {shippingCharge === 0
                      ? "FREE"
                      : `₹${shippingCharge}`}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Discount
                  </span>

                  <span className="font-semibold text-slate-900">
                    ₹
                    {discount.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-slate-500">
                        Total Amount
                      </p>

                      <p className="mt-1 text-3xl font-black text-slate-900">
                        ₹
                        {total.toLocaleString(
                          "en-IN"
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      COD
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">
                <p className="font-bold">Secure checkout validation</p>
                <p className="mt-1">
                  Product price, seller ownership, wholesale rules, MOQ and
                  stock are verified again on the server before the order is created.
                </p>
              </div>

              <button
                type="button"
                onClick={placeOrder}
                disabled={placingOrder}
                className="mt-7 w-full rounded-2xl bg-slate-900 px-5 py-4 text-base font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {placingOrder
                  ? "Placing Order..."
                  : `Place COD Order • ₹${total.toLocaleString("en-IN")}`}
              </button>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                By placing this order, you confirm that the delivery information provided by you is correct.
              </div>

              <Link
                href="/cart"
                className="mt-4 block text-center text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                ← Modify Cart
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
            : "border-slate-200 focus:border-slate-900 focus:ring-slate-100"
        }`}
      />

      {error && (
        <p className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
