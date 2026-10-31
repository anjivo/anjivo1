"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Variant = {
  id: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  value: string;
  stock: number;
  status: string;
};

type Product = {
  id: string;
  name: string;
  sellerId: string;
  sellerName: string;
  status: string;
  stock: number;
  retailPrice: number;
  wholesalePrice: number;
  moq: number;
  saleUnit: "PIECE" | "SET" | "";
  variants: Variant[];
};

type DraftLine = {
  key: string;
  productId: string;
  sellerId: string;
  productName: string;
  sellerName: string;
  quantity: number;
  pricingType: "retail" | "wholesale";
  wholesaleUnit?: "PIECE" | "SET";
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariantValue?: string;
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numericValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getVariantLabel(variant: Variant): string {
  return [
    variant.name,
    variant.size ? `Size: ${variant.size}` : "",
    variant.color ? `Colour: ${variant.color}` : "",
    variant.value,
    variant.sku ? `SKU: ${variant.sku}` : "",
    `Stock: ${variant.stock}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function AdminCreateOrderPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [pricingType, setPricingType] = useState<"retail" | "wholesale">("retail");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Uttar Pradesh");
  const [pincode, setPincode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedVariant = selectedProduct?.variants.find((variant) => variant.id === selectedVariantId);
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      `${product.name} ${product.sellerName} ${product.id}`.toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login?redirect=/admin/orders/create";
        return;
      }

      setLoading(true);
      setError("");

      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        const role = textValue(userSnapshot.data()?.role).toUpperCase();

        if (!userSnapshot.exists() || !["ADMIN", "SUPERADMIN"].includes(role)) {
          window.location.href = "/admin";
          return;
        }

        const productsSnapshot = await getDocs(collection(db, "products"));
        const loadedProducts: Product[] = productsSnapshot.docs
          .map((productDoc) => {
            const data = productDoc.data();
            const rawVariants = data.variantConfiguration &&
              typeof data.variantConfiguration === "object"
              ? (data.variantConfiguration as Record<string, unknown>).variants
              : [];

            const variants: Variant[] = Array.isArray(rawVariants)
              ? rawVariants
                  .filter((raw) => raw && typeof raw === "object")
                  .map((raw) => {
                    const variant = raw as Record<string, unknown>;
                    return {
                      id: textValue(variant.id),
                      sku: textValue(variant.sku),
                      name: textValue(variant.name),
                      size: textValue(variant.size),
                      color: textValue(variant.color),
                      value: textValue(variant.value),
                      stock: Math.max(0, Math.floor(numericValue(variant.stock))),
                      status: textValue(variant.status) || "active",
                    };
                  })
                  .filter((variant) => Boolean(variant.id))
              : [];

            const wholesaleConfig =
              data.wholesaleConfiguration && typeof data.wholesaleConfiguration === "object"
                ? (data.wholesaleConfiguration as Record<string, unknown>)
                : {};

            const wholesaleEnabled = wholesaleConfig.enabled !== false;
            const saleUnit: "PIECE" | "SET" | "" = !wholesaleEnabled
              ? ""
              : wholesaleConfig.saleUnit === "SET"
                ? "SET"
                : wholesaleConfig.saleUnit === "PIECE" ||
                    (data.sellingMode !== "SET" && numericValue(data.wholesalePrice) > 0)
                  ? "PIECE"
                  : "";

            return {
              id: productDoc.id,
              name: textValue(data.name) || "Unnamed product",
              sellerId: textValue(data.sellerId),
              sellerName: textValue(data.sellerName) || "ANJIVO Seller",
              status: textValue(data.status).toLowerCase() || "active",
              stock: Math.max(0, Math.floor(numericValue(data.stock))),
              retailPrice: numericValue(data.retailPrice),
              wholesalePrice: numericValue(data.wholesalePrice),
              moq: Math.max(1, Math.floor(numericValue(data.moq) || 1)),
              saleUnit,
              variants,
            };
          })
          .filter((product) =>
            product.sellerId &&
            product.status === "active" &&
            product.stock > 0
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        if (cancelled) return;
        setAuthorized(true);
        setProducts(loadedProducts);
        setLoading(false);
      } catch (loadError) {
        console.error("Admin manual order load error:", loadError);
        if (!cancelled) {
          setError("Products load nahi ho paaye. Admin permissions aur Firestore rules check karein.");
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setSelectedVariantId("");
    setQuantity("1");
    setPricingType(selectedProduct?.saleUnit === "SET" ? "wholesale" : "retail");
  }, [selectedProductId, products]);

  function addLine() {
    setError("");
    if (!selectedProduct) {
      setError("Pehle product select karein.");
      return;
    }

    const parsedQuantity = Math.floor(Number(quantity));
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError("Valid quantity enter karein.");
      return;
    }

    if (selectedProduct.variants.length > 0 && !selectedVariant) {
      setError("Is product ke liye size/colour variant select karein.");
      return;
    }

    if (selectedVariant && parsedQuantity > selectedVariant.stock) {
      setError(`Selected variant ka available stock ${selectedVariant.stock} hai.`);
      return;
    }

    if (parsedQuantity > selectedProduct.stock) {
      setError(`Product ka available stock ${selectedProduct.stock} hai.`);
      return;
    }

    const wholesaleUnit =
      pricingType === "wholesale"
        ? (selectedProduct.saleUnit || "PIECE")
        : undefined;

    const key = [
      selectedProduct.id,
      selectedVariant?.id || "no-variant",
      pricingType,
      wholesaleUnit || "none",
    ].join("::");

    const newLine: DraftLine = {
      key,
      productId: selectedProduct.id,
      sellerId: selectedProduct.sellerId,
      productName: selectedProduct.name,
      sellerName: selectedProduct.sellerName,
      quantity: parsedQuantity,
      pricingType,
      ...(wholesaleUnit ? { wholesaleUnit } : {}),
      ...(selectedVariant
        ? {
            variantId: selectedVariant.id,
            variantSku: selectedVariant.sku,
            variantName: selectedVariant.name,
            ...(selectedVariant.size ? { selectedSize: selectedVariant.size } : {}),
            ...(selectedVariant.color ? { selectedColor: selectedVariant.color } : {}),
            ...(selectedVariant.value ? { selectedVariantValue: selectedVariant.value } : {}),
          }
        : {}),
    };

    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (!existing) return [...current, newLine];
      return current.map((line) =>
        line.key === key
          ? { ...line, quantity: line.quantity + parsedQuantity }
          : line
      );
    });
    setSuccess(`${selectedProduct.name} order list mein add ho gaya.`);
  }

  function updateLineQuantity(key: string, value: string) {
    const parsed = Math.floor(Number(value));
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, quantity: parsed } : line))
    );
  }

  async function createOrder() {
    setError("");
    setSuccess("");

    if (!customerName.trim()) {
      setError("Customer name required hai.");
      return;
    }
    if (lines.length === 0) {
      setError("Kam se kam ek product add karein.");
      return;
    }
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !/^\d{6}$/.test(pincode.trim())) {
      setError("Complete delivery address aur valid 6 digit PIN code enter karein.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError("Admin session expire ho gaya. Dobara login karein.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          shippingAddress: {
            fullName: customerName.trim(),
            addressLine1: addressLine1.trim(),
            ...(addressLine2.trim() ? { addressLine2: addressLine2.trim() } : {}),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
          },
          items: lines.map((line) => ({
            productId: line.productId,
            sellerId: line.sellerId,
            quantity: line.quantity,
            pricingType: line.pricingType,
            ...(line.wholesaleUnit ? { wholesaleUnit: line.wholesaleUnit } : {}),
            ...(line.variantId ? { variantId: line.variantId } : {}),
            ...(line.variantSku ? { variantSku: line.variantSku } : {}),
            ...(line.variantName ? { variantName: line.variantName } : {}),
            ...(line.selectedSize ? { selectedSize: line.selectedSize } : {}),
            ...(line.selectedColor ? { selectedColor: line.selectedColor } : {}),
            ...(line.selectedVariantValue ? { selectedVariantValue: line.selectedVariantValue } : {}),
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success || !result.orderId) {
        throw new Error(result.message || "Manual order create nahi ho saka.");
      }

      setSuccess(`Order ${result.orderId} successfully create ho gaya.`);
      router.push(`/admin/orders/${result.orderId}`);
    } catch (createError) {
      console.error("Manual order create error:", createError);
      setError(createError instanceof Error ? createError.message : "Manual order create nahi ho saka.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-sm text-gray-500 shadow-sm">
          Admin access aur products load ho rahe hain...
        </div>
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">ADMIN / ORDERS</p>
            <h1 className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">Create Manual Order</h1>
            <p className="mt-1 text-sm text-gray-500">Guest customer ke liye bina mobile number, OTP ya account ke order banayein.</p>
          </div>
          <Link href="/admin/orders" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100">
            ← Back to Orders
          </Link>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        {success && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">{success}</div>}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-gray-900">Guest Customer Details</h2>
              <p className="mt-1 text-xs text-gray-500">Koi Firebase customer account create nahi hoga.</p>
            </div>

            <label className="block text-sm font-semibold text-gray-700">
              Customer Name *
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" placeholder="Customer full name" />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Custom Email (optional, verification nahi hogi)
              <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" placeholder="customer@example.com" />
            </label>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-black text-gray-900">Delivery Address</h3>
              <label className="mb-3 block text-sm font-semibold text-gray-700">
                Address Line 1 *
                <input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" placeholder="House no., street, mohalla" />
              </label>
              <label className="mb-3 block text-sm font-semibold text-gray-700">
                Address Line 2
                <input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" placeholder="Landmark / area (optional)" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-gray-700">
                  City *
                  <input value={city} onChange={(event) => setCity(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" placeholder="City" />
                </label>
                <label className="block text-sm font-semibold text-gray-700">
                  State *
                  <input value={state} onChange={(event) => setState(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" placeholder="State" />
                </label>
              </div>
              <label className="mt-3 block text-sm font-semibold text-gray-700">
                PIN Code *
                <input inputMode="numeric" maxLength={6} value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" placeholder="6 digit PIN code" />
              </label>
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-gray-900">Add Products</h2>
              <p className="mt-1 text-xs text-gray-500">Product price aur stock server par dobara validate honge.</p>
            </div>

            <label className="block text-sm font-semibold text-gray-700">
              Search Product
              <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" placeholder="Product name / seller / ID" />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Product *
              <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-black">
                <option value="">Select product</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · Stock {product.stock} · {product.sellerName}
                  </option>
                ))}
              </select>
            </label>

            {selectedProduct && selectedProduct.variants.length > 0 && (
              <label className="block text-sm font-semibold text-gray-700">
                Size / Colour Variant *
                <select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-black">
                  <option value="">Select variant</option>
                  {selectedProduct.variants.filter((variant) => variant.status === "active" && variant.stock > 0).map((variant) => (
                    <option key={variant.id} value={variant.id}>{getVariantLabel(variant)}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-gray-700">
                Quantity *
                <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-black" />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Pricing Type
                <select value={pricingType} onChange={(event) => setPricingType(event.target.value as "retail" | "wholesale")} className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-black">
                  <option value="retail">Retail</option>
                  <option value="wholesale" disabled={!selectedProduct?.saleUnit}>Wholesale</option>
                </select>
              </label>
            </div>

            {selectedProduct && (
              <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                <div className="flex justify-between"><span>Retail price</span><strong>₹{selectedVariant?.stock !== undefined ? "Variant price server-verified" : selectedProduct.retailPrice.toLocaleString("en-IN")}</strong></div>
                <div className="mt-1 flex justify-between"><span>Wholesale setup</span><strong>{selectedProduct.saleUnit || "Not configured"}</strong></div>
                <div className="mt-1 flex justify-between"><span>Minimum wholesale quantity</span><strong>{selectedProduct.saleUnit === "PIECE" ? Math.max(10, selectedProduct.moq) : selectedProduct.moq}</strong></div>
              </div>
            )}

            <button type="button" onClick={addLine} className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-black text-white hover:bg-black">
              + Add Product to Order
            </button>

            <div className="border-t border-gray-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-900">Order Items</h3>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">{lines.length} lines</span>
              </div>

              {lines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">Abhi koi product add nahi hua.</div>
              ) : (
                <div className="space-y-3">
                  {lines.map((line) => (
                    <div key={line.key} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900">{line.productName}</p>
                          <p className="mt-1 text-xs text-gray-500">{line.variantName || [line.selectedSize, line.selectedColor, line.variantSku].filter(Boolean).join(" · ") || line.sellerName}</p>
                          <p className="mt-1 text-[11px] font-bold uppercase text-gray-500">{line.pricingType} {line.wholesaleUnit ? `· ${line.wholesaleUnit}` : ""}</p>
                        </div>
                        <button type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="text-xs font-bold text-red-600">Remove</button>
                      </div>
                      <label className="mt-3 flex items-center gap-3 text-xs font-semibold text-gray-600">
                        Quantity
                        <input type="number" min={1} value={line.quantity} onChange={(event) => updateLineQuantity(line.key, event.target.value)} className="h-9 w-24 rounded-lg border border-gray-200 px-2 text-sm text-gray-900" />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/admin/orders" className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-center text-sm font-bold text-gray-700">Cancel</Link>
          <button type="button" disabled={submitting || lines.length === 0} onClick={createOrder} className="rounded-xl bg-black px-7 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "Creating Order..." : "Create Real Order (COD)"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Guest order: no phone number · no OTP · no Firebase customer account · server-side price and stock validation.
        </p>
      </div>
    </main>
  );
}
