"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth, db } from "@/lib/firebase";
import { createAdminProduct } from "@/lib/admin-products";
import { getCategories } from "@/lib/categories";
import type { Category } from "@/types/category";

type SellingMode = "PIECE" | "SET" | "BOTH";
type SaleUnit = "PIECE" | "SET";
type VariantType = "SIZE" | "COLOR" | "SIZE_COLOR" | "CUSTOM";

type Tier = {
  minQuantity: string;
  maxQuantity: string;
  price: string;
};

type VariantRow = {
  id: string;
  label: string;
  size: string;
  color: string;
  sku: string;
  barcode: string;
  price: string;
  mrp: string;
  stock: string;
  enabled: boolean;
  imageUrl: string;
};

const DEFAULT_TIERS: Tier[] = [
  { minQuantity: "10", maxQuantity: "24", price: "" },
  { minQuantity: "25", maxQuantity: "49", price: "" },
  { minQuantity: "50", maxQuantity: "99", price: "" },
  { minQuantity: "100", maxQuantity: "", price: "" },
];

const inputClass =
  "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black";
const labelClass = "text-xs font-bold text-gray-700";
const sectionClass =
  "rounded-3xl border border-gray-200 bg-white p-5 sm:p-7";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function AdminNewProductPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  // Basic information
  const [name, setName] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [tagsText, setTagsText] = useState("");

  // Images
  const [imageUrlsText, setImageUrlsText] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Selling and pricing
  const [sellingMode, setSellingMode] = useState<SellingMode>("BOTH");
  const [mrp, setMrp] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [wholesaleEnabled, setWholesaleEnabled] = useState(true);
  const [wholesaleSaleUnit, setWholesaleSaleUnit] =
    useState<SaleUnit>("PIECE");
  const [wholesalePriceUnit, setWholesalePriceUnit] =
    useState<"PER_PIECE" | "PER_SET">("PER_PIECE");
  const [moq, setMoq] = useState("10");
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);

  // Set configuration
  const [setBreakAllowed, setSetBreakAllowed] = useState(false);
  const [wholesaleSetName, setWholesaleSetName] = useState("");
  const [setSize, setSetSize] = useState("");
  const [composition, setComposition] = useState("");
  const [moqSets, setMoqSets] = useState("1");

  // Inventory / variants
  const [stock, setStock] = useState("0");
  const [variantEnabled, setVariantEnabled] = useState(false);
  const [variantType, setVariantType] = useState<VariantType>("SIZE_COLOR");
  const [sizesText, setSizesText] = useState("");
  const [colorsText, setColorsText] = useState("");
  const [customOptionsText, setCustomOptionsText] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([]);

  // Marketplace controls
  const [featured, setFeatured] = useState(false);
  const [bestSeller, setBestSeller] = useState(false);
  const [trending, setTrending] = useState(false);
  const [status, setStatus] = useState<"active" | "draft">("active");

  const imageUrls = useMemo(() => {
    const fromLines = imageUrlsText
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    const all = [...fromLines, imageUrl.trim()].filter(Boolean);
    return Array.from(new Set(all));
  }, [imageUrlsText, imageUrl]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/admin/products/new");
        return;
      }

      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        if (!userSnapshot.exists()) {
          setError("Admin profile not found.");
          return;
        }

        if (userSnapshot.data().role !== "ADMIN") {
          setError("Admin access required.");
          return;
        }

        const result = await getCategories();
        setCategories(
          result.filter((category) => category.status === "active")
        );
      } catch (err) {
        console.error("Admin product auth error:", err);
        setError("Unable to load admin product page.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    const selected = categories.find((item) => item.id === value);
    setCategoryName(selected?.name ?? "");
  }

  function updateTier(index: number, field: keyof Tier, value: string) {
    setTiers((current) =>
      current.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier))
    );
  }

  function addTier() {
    setTiers((current) => [
      ...current,
      { minQuantity: "", maxQuantity: "", price: "" },
    ]);
  }

  function removeTier(index: number) {
    setTiers((current) => current.filter((_, i) => i !== index));
  }

  function generateVariants() {
    const sizes = sizesText
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    const colors = colorsText
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    const customs = customOptionsText
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);

    let combinations: Array<{ size: string; color: string; label: string }> = [];

    if (variantType === "SIZE") {
      combinations = sizes.map((size) => ({ size, color: "", label: size }));
    } else if (variantType === "COLOR") {
      combinations = colors.map((color) => ({ size: "", color, label: color }));
    } else if (variantType === "SIZE_COLOR") {
      combinations = sizes.flatMap((size) =>
        colors.map((color) => ({
          size,
          color,
          label: `${size} / ${color}`,
        }))
      );
    } else {
      combinations = customs.map((label) => ({ size: "", color: "", label }));
    }

    if (!combinations.length) {
      setError("Please enter variant options before generating variants.");
      return;
    }

    if (combinations.length > 250) {
      setError("Please keep generated variants to 250 or fewer.");
      return;
    }

    setError("");
    setVariants(
      combinations.map((item) => ({
        id: makeId(),
        ...item,
        sku: "",
        barcode: "",
        price: retailPrice,
        mrp,
        stock: "0",
        enabled: true,
        imageUrl: "",
      }))
    );
  }

  function updateVariant(
    id: string,
    field: keyof VariantRow,
    value: string | boolean
  ) {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant
      )
    );
  }

  function removeVariant(id: string) {
    setVariants((current) => current.filter((variant) => variant.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError("");
      setSaving(true);

      const user = auth.currentUser;
      if (!user) throw new Error("Admin session expired. Please login again.");
      if (!name.trim()) throw new Error("Product name is required.");
      if (!categoryId) throw new Error("Please select a category.");
      if (!imageUrls.length) {
        throw new Error("Please add at least one product image URL.");
      }

      const mrpValue = toNumber(mrp, NaN);
      const retailValue = toNumber(retailPrice, NaN);
      const wholesaleValue = toNumber(wholesalePrice, NaN);
      const moqValue = toNumber(moq, NaN);
      const stockValue = toNumber(stock, NaN);

      if (!Number.isFinite(mrpValue) || mrpValue <= 0)
        throw new Error("Enter a valid MRP.");
      if (
        sellingMode !== "PIECE" &&
        (!Number.isFinite(retailValue) || retailValue <= 0)
      ) {
        throw new Error("Enter a valid retail price.");
      }
      if (sellingMode !== "SET" && retailValue > mrpValue)
        throw new Error("Retail price cannot be higher than MRP.");
      if (
        wholesaleEnabled &&
        sellingMode !== "SET" &&
        (!Number.isFinite(wholesaleValue) || wholesaleValue <= 0)
      ) {
        throw new Error("Enter a valid wholesale price.");
      }
      if (!Number.isFinite(moqValue) || moqValue < 1)
        throw new Error("MOQ must be at least 1.");
      if (!Number.isFinite(stockValue) || stockValue < 0)
        throw new Error("Stock cannot be negative.");
      if (
        (sellingMode === "SET" || sellingMode === "BOTH") &&
        (!wholesaleSetName.trim() || !setSize.trim())
      ) {
        throw new Error("For set selling, enter set name and pieces per set.");
      }
      if (wholesaleEnabled && wholesaleSaleUnit === "SET") {
        const sets = toNumber(moqSets, NaN);
        if (!Number.isFinite(sets) || sets < 1)
          throw new Error("Minimum sets must be at least 1.");
      }

      const wholesaleTiers = tiers
        .filter((tier) => tier.minQuantity.trim() || tier.price.trim())
        .map((tier) => {
          const minQuantity = Number(tier.minQuantity);
          const maxQuantity = tier.maxQuantity.trim()
            ? Number(tier.maxQuantity)
            : undefined;
          const price = Number(tier.price);

          if (!Number.isFinite(minQuantity) || minQuantity < 1)
            throw new Error("Invalid wholesale minimum quantity.");
          if (
            maxQuantity !== undefined &&
            (!Number.isFinite(maxQuantity) || maxQuantity < minQuantity)
          ) {
            throw new Error("Invalid wholesale quantity range.");
          }
          if (!Number.isFinite(price) || price <= 0)
            throw new Error("Invalid wholesale tier price.");
          return {
            minQuantity: Math.floor(minQuantity),
            ...(maxQuantity !== undefined
              ? { maxQuantity: Math.floor(maxQuantity) }
              : {}),
            price,
          };
        })
        .sort((a, b) => a.minQuantity - b.minQuantity);

      for (let i = 0; i < wholesaleTiers.length - 1; i++) {
        const current = wholesaleTiers[i];
        const next = wholesaleTiers[i + 1];
        if (
          current.maxQuantity !== undefined &&
          current.maxQuantity >= next.minQuantity
        ) {
          throw new Error("Wholesale quantity ranges cannot overlap.");
        }
      }

      const normalizedVariants = variants
        .filter((variant) => variant.enabled)
        .map((variant) => {
          const variantStock = Number(variant.stock);
          const variantPrice = variant.price.trim()
            ? Number(variant.price)
            : retailValue;
          const variantMrp = variant.mrp.trim()
            ? Number(variant.mrp)
            : mrpValue;

          if (!Number.isFinite(variantStock) || variantStock < 0)
            throw new Error(`Invalid stock for variant ${variant.label}.`);
          if (!Number.isFinite(variantPrice) || variantPrice <= 0)
            throw new Error(`Invalid price for variant ${variant.label}.`);
          if (!Number.isFinite(variantMrp) || variantMrp <= 0)
            throw new Error(`Invalid MRP for variant ${variant.label}.`);
          if (variantPrice > variantMrp)
            throw new Error(`Price cannot exceed MRP for ${variant.label}.`);

          return {
            id: variant.id,
            label: variant.label,
            ...(variant.size ? { size: variant.size } : {}),
            ...(variant.color ? { color: variant.color } : {}),
            ...(variant.sku.trim() ? { sku: variant.sku.trim() } : {}),
            ...(variant.barcode.trim()
              ? { barcode: variant.barcode.trim() }
              : {}),
            price: variantPrice,
            mrp: variantMrp,
            stock: Math.floor(variantStock),
            enabled: true,
            ...(variant.imageUrl.trim()
              ? { imageUrl: variant.imageUrl.trim() }
              : {}),
          };
        });

      if (variantEnabled && !normalizedVariants.length) {
        throw new Error("Generate and enable at least one product variant.");
      }

      const finalSlug = slug.trim() || slugify(name);
      const tags = tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const payload = {
        name: name.trim(),
        slug: finalSlug,
        description: description.trim(),
        brand: brand.trim(),
        categoryId,
        categoryName,
        sellerId: user.uid,
        sellerName: "ANJIVO Official",
        sellerVerified: true,
        images: imageUrls,
        image: imageUrls[0],
        mrp: mrpValue,
        retailPrice: sellingMode === "PIECE" ? 0 : retailValue,
        wholesalePrice: wholesaleEnabled ? wholesaleValue : 0,
        moq: Math.floor(moqValue),
        wholesaleTiers: wholesaleEnabled ? wholesaleTiers : [],
        stock: Math.floor(stockValue),
        sellingMode,
        wholesaleConfiguration: {
          enabled: wholesaleEnabled,
          saleUnit: wholesaleSaleUnit,
          setBreakAllowed,
          setSize: setSize.trim() ? Number(setSize) : undefined,
          setName: wholesaleSetName.trim(),
          composition: composition.trim(),
          moqSets: Math.max(1, Math.floor(toNumber(moqSets, 1))),
          priceUnit: wholesalePriceUnit,
          tiers: wholesaleEnabled ? wholesaleTiers : [],
        },
        variantConfiguration: {
          enabled: variantEnabled,
          type: variantType,
          sizes: sizesText
            .split(/[,\n]/)
            .map((v) => v.trim())
            .filter(Boolean),
          colors: colorsText
            .split(/[,\n]/)
            .map((v) => v.trim())
            .filter(Boolean),
          variants: variantEnabled ? normalizedVariants : [],
        },
        variants: variantEnabled ? normalizedVariants : [],
        tags,
        status,
        featured,
        bestSeller,
        trending,
        rating: 0,
        reviewsCount: 0,
      };

      // Keep the current admin helper as the single write path.
      await createAdminProduct(user.uid, payload as any);
      router.push("/admin/products");
    } catch (err) {
      console.error("Admin create product error:", err);
      setError(
        err instanceof Error ? err.message : "Unable to create product."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">⏳</div>
            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading Admin Product Manager...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error && !categories.length) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-black text-red-800">
              Admin Product Manager
            </h1>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <Link
              href="/admin"
              className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              ← Admin Dashboard
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-xs font-bold text-gray-400 hover:text-black"
          >
            ← Admin Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-black tracking-tight">
            List ANJIVO Product
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Advanced wholesale and retail product manager.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={sectionClass}>
            <h2 className="text-lg font-black">1. Basic Information</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Product Name *">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Premium Cotton T-Shirt"
                  className={inputClass}
                />
              </Field>
              <Field label="Product Slug">
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="premium-cotton-t-shirt"
                  className={inputClass}
                />
              </Field>
              <Field label="Brand">
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Brand name"
                  className={inputClass}
                />
              </Field>
              <Field label="Category *">
                <select
                  required
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Product details, fabric, fit, care instructions..."
                className={inputClass}
              />
            </Field>
            <Field label="Tags (comma separated)">
              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="menswear, t-shirt, cotton"
                className={inputClass}
              />
            </Field>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-black">2. Product Images</h2>
            <p className="mt-1 text-xs text-gray-500">
              Paste publicly accessible image URLs. Add one URL per line or separated by commas.
            </p>
            <textarea
              value={imageUrlsText}
              onChange={(e) => setImageUrlsText(e.target.value)}
              rows={4}
              placeholder={"https://.../front.jpg\nhttps://.../back.jpg"}
              className={inputClass}
            />
            <Field label="Additional / primary image URL">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/product.jpg"
                className={inputClass}
              />
            </Field>
            {imageUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {imageUrls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                  >
                    <img
                      src={url}
                      alt={`${name || "Product"} ${index + 1}`}
                      className="h-36 w-full object-contain"
                    />
                    <p className="truncate px-2 py-1 text-[10px] text-gray-500">
                      Image {index + 1}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-black">3. Selling Mode & Pricing</h2>
            <p className="mt-1 text-xs text-gray-500">
              Choose how customers can purchase this product.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["PIECE", "SET", "BOTH"] as SellingMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSellingMode(mode)}
                  className={`rounded-2xl border p-4 text-left ${
                    sellingMode === mode
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="font-black">{mode}</p>
                  <p className="mt-1 text-xs opacity-70">
                    {mode === "PIECE"
                      ? "Sell individual pieces"
                      : mode === "SET"
                      ? "Sell complete sets"
                      : "Allow piece and set selling"}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <PriceField label="MRP (₹) *" value={mrp} onChange={setMrp} />
              {sellingMode !== "PIECE" && (
                <PriceField
                  label="Retail Price (₹)"
                  value={retailPrice}
                  onChange={setRetailPrice}
                />
              )}
              {wholesaleEnabled && (
                <PriceField
                  label="Wholesale From (₹)"
                  value={wholesalePrice}
                  onChange={setWholesalePrice}
                />
              )}
            </div>
            <div className="mt-5 rounded-2xl border border-gray-200 p-4">
              <label className="flex items-center gap-3 text-sm font-bold">
                <input
  type="checkbox"
  checked={wholesaleEnabled}
  onChange={(e) => setWholesaleEnabled(e.target.checked)}
  className="h-4 w-4"
/>
                Enable wholesale pricing
              </label>
              {wholesaleEnabled && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Wholesale Sale Unit">
                    <select
                      value={wholesaleSaleUnit}
                      onChange={(e) =>
                        setWholesaleSaleUnit(e.target.value as SaleUnit)
                      }
                      className={inputClass}
                    >
                      <option value="PIECE">Per piece</option>
                      <option value="SET">Per set</option>
                    </select>
                  </Field>
                  <Field label="Wholesale Price Unit">
                    <select
                      value={wholesalePriceUnit}
                      onChange={(e) =>
                        setWholesalePriceUnit(
                          e.target.value as "PER_PIECE" | "PER_SET"
                        )
                      }
                      className={inputClass}
                    >
                      <option value="PER_PIECE">Price per piece</option>
                      <option value="PER_SET">Price per set</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>
          </section>

          {(sellingMode === "SET" || sellingMode === "BOTH") && (
            <section className={sectionClass}>
              <h2 className="text-lg font-black">4. Set / Pack Configuration</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field label="Set Name">
                  <input
                    value={wholesaleSetName}
                    onChange={(e) => setWholesaleSetName(e.target.value)}
                    placeholder="Pack of 3 / Combo set"
                    className={inputClass}
                  />
                </Field>
                <Field label="Pieces per Set">
                  <input
                    type="number"
                    min="1"
                    value={setSize}
                    onChange={(e) => setSetSize(e.target.value)}
                    placeholder="3"
                    className={inputClass}
                  />
                </Field>
                <Field label="Minimum Sets">
                  <input
                    type="number"
                    min="1"
                    value={moqSets}
                    onChange={(e) => setMoqSets(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Set Composition / Sizes">
                  <input
                    value={composition}
                    onChange={(e) => setComposition(e.target.value)}
                    placeholder="S:1, M:1, L:1"
                    className={inputClass}
                  />
                </Field>
              </div>
              <label className="mt-5 flex items-center gap-3 text-sm font-bold">
               <input
  type="checkbox"
  checked={setBreakAllowed}
  onChange={(e) => setSetBreakAllowed(e.target.checked)}
  className="h-4 w-4"
/>
                Allow breaking sets into individual pieces
              </label>
            </section>
          )}

          {wholesaleEnabled && (
            <section className={sectionClass}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black">5. Wholesale Quantity Tiers</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Set quantity-based prices. Leave a tier empty to ignore it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addTier}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
                >
                  + Add Tier
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {tiers.map((tier, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-black">Tier {index + 1}</p>
                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTier(index)}
                          className="text-[10px] font-bold text-red-500"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <TierField
                        label="Minimum Qty"
                        value={tier.minQuantity}
                        onChange={(value) =>
                          updateTier(index, "minQuantity", value)
                        }
                      />
                      <TierField
                        label="Maximum Qty (optional)"
                        value={tier.maxQuantity}
                        placeholder="No limit"
                        onChange={(value) =>
                          updateTier(index, "maxQuantity", value)
                        }
                      />
                      <TierField
                        label={`Price (${wholesalePriceUnit === "PER_SET" ? "per set" : "per piece"})`}
                        value={tier.price}
                        onChange={(value) => updateTier(index, "price", value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={sectionClass}>
            <h2 className="text-lg font-black">6. Variants (Size / Colour / SKU)</h2>
            <label className="mt-4 flex items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={variantEnabled}
                onChange={(e) => setVariantEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              This product has variants
            </label>
            {variantEnabled && (
              <>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field label="Variant Type">
                    <select
                      value={variantType}
                      onChange={(e) =>
                        setVariantType(e.target.value as VariantType)
                      }
                      className={inputClass}
                    >
                      <option value="SIZE">Size</option>
                      <option value="COLOR">Colour</option>
                      <option value="SIZE_COLOR">Size + Colour</option>
                      <option value="CUSTOM">Custom options</option>
                    </select>
                  </Field>
                  {(variantType === "SIZE" || variantType === "SIZE_COLOR") && (
                    <Field label="Sizes (comma separated)">
                      <input
                        value={sizesText}
                        onChange={(e) => setSizesText(e.target.value)}
                        placeholder="S, M, L, XL, XXL"
                        className={inputClass}
                      />
                    </Field>
                  )}
                  {(variantType === "COLOR" || variantType === "SIZE_COLOR") && (
                    <Field label="Colours (comma separated)">
                      <input
                        value={colorsText}
                        onChange={(e) => setColorsText(e.target.value)}
                        placeholder="Black, White, Navy"
                        className={inputClass}
                      />
                    </Field>
                  )}
                  {variantType === "CUSTOM" && (
                    <Field label="Custom options (comma separated)">
                      <input
                        value={customOptionsText}
                        onChange={(e) => setCustomOptionsText(e.target.value)}
                        placeholder="Regular, Premium, Deluxe"
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
                <button
                  type="button"
                  onClick={generateVariants}
                  className="mt-4 rounded-xl bg-gray-900 px-5 py-3 text-xs font-bold text-white"
                >
                  Generate Variants
                </button>

                {variants.length > 0 && (
                  <div className="mt-5 space-y-4">
                    {variants.map((variant, index) => (
                      <div
                        key={variant.id}
                        className="rounded-2xl border border-gray-200 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-black">
                            {index + 1}. {variant.label}
                          </p>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={variant.enabled}
                                onChange={(e) =>
                                  updateVariant(
                                    variant.id,
                                    "enabled",
                                    e.target.checked
                                  )
                                }
                              />
                              Active
                            </label>
                            <button
                              type="button"
                              onClick={() => removeVariant(variant.id)}
                              className="text-xs font-bold text-red-500"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <TierField
                            label="SKU"
                            value={variant.sku}
                            onChange={(v) => updateVariant(variant.id, "sku", v)}
                          />
                          <TierField
                            label="Barcode"
                            value={variant.barcode}
                            onChange={(v) =>
                              updateVariant(variant.id, "barcode", v)
                            }
                          />
                          <TierField
                            label="Price"
                            value={variant.price}
                            onChange={(v) =>
                              updateVariant(variant.id, "price", v)
                            }
                          />
                          <TierField
                            label="MRP"
                            value={variant.mrp}
                            onChange={(v) => updateVariant(variant.id, "mrp", v)}
                          />
                          <TierField
                            label="Stock"
                            value={variant.stock}
                            onChange={(v) =>
                              updateVariant(variant.id, "stock", v)
                            }
                          />
                          <TierField
                            label="Variant Image URL"
                            value={variant.imageUrl}
                            onChange={(v) =>
                              updateVariant(variant.id, "imageUrl", v)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-black">7. Inventory & MOQ</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Minimum Order Quantity (pieces)">
                <input
                  type="number"
                  min="1"
                  value={moq}
                  onChange={(e) => setMoq(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Total Stock">
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-black">8. Publishing & Marketplace Labels</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PublishOption
                active={status === "active"}
                title="Publish Now"
                description="Product will be visible on the marketplace."
                onClick={() => setStatus("active")}
              />
              <PublishOption
                active={status === "draft"}
                title="Save as Draft"
                description="Keep product hidden until ready."
                onClick={() => setStatus("draft")}
              />
            </div>
            <div className="mt-5 space-y-3">
              <CheckOption
                checked={featured}
                onChange={setFeatured}
                title="Featured Product"
              />
              <CheckOption
                checked={bestSeller}
                onChange={setBestSeller}
                title="Best Seller"
              />
              <CheckOption
                checked={trending}
                onChange={setTrending}
                title="Trending Product"
              />
            </div>
          </section>

          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:justify-end">
            <Link
              href="/admin/products"
              className="rounded-xl border border-gray-200 px-6 py-3 text-center text-sm font-bold text-gray-700 hover:border-black"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-7 py-3 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving Product..." : "List Product"}
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="mt-2 flex items-center rounded-xl border border-gray-200">
        <span className="px-3 text-sm font-bold text-gray-400">₹</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl px-2 py-3 text-sm outline-none"
        />
      </div>
    </Field>
  );
}

function TierField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-500">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black"
      />
    </div>
  );
}

function CheckOption({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <p className="text-sm font-bold">{title}</p>
    </label>
  );
}

function PublishOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left ${
        active ? "border-black bg-black text-white" : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-sm font-black">{title}</p>
      <p className={`mt-1 text-xs ${active ? "text-gray-300" : "text-gray-500"}`}>
        {description}
      </p>
    </button>
  );
}
