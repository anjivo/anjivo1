"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { getProductBySlug } from "@/lib/products";
import { auth } from "@/lib/firebase";
import { addToCart } from "@/lib/cart";

import type {
  Product,
  WholesaleUnit,
} from "@/types/product";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type PricingType =
  | "retail"
  | "wholesale";

export default function ProductDetailsPage({
  params,
}: ProductPageProps) {
  const router = useRouter();

  const [product, setProduct] =
    useState<Product | null>(null);

  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [pricingType, setPricingType] =
    useState<PricingType>("retail");

  const [wholesaleUnit, setWholesaleUnit] =
    useState<WholesaleUnit>("PIECE");

  /*
   * Quantity means:
   *
   * Retail:
   *   number of pieces
   *
   * Wholesale PIECE:
   *   number of pieces
   *
   * Wholesale SET:
   *   number of sets
   */
  const [quantity, setQuantity] =
    useState(1);

  const [addingToCart, setAddingToCart] =
    useState(false);

  const [cartMessage, setCartMessage] =
    useState("");

  /* =======================================================
     LOAD PRODUCT
  ======================================================= */

  useEffect(() => {
    async function loadProduct() {
      try {
        const { slug } = await params;

        const result =
          await getProductBySlug(slug);

        setProduct(result);
      } catch (error) {
        console.error(
          "Failed to load product:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [params]);

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {
          setUser(currentUser);
        }
      );

    return () => unsubscribe();
  }, []);

  /* =======================================================
     WHOLESALE CONFIG
  ======================================================= */

  const wholesaleConfig =
    product?.wholesaleConfiguration;

  const wholesaleEnabled =
    Boolean(
      wholesaleConfig?.enabled
    ) &&
    Array.isArray(
      wholesaleConfig?.tiers
    ) &&
    wholesaleConfig.tiers.length > 0;

  const configuredWholesaleUnit =
    wholesaleConfig?.saleUnit;

  const setEnabled =
    wholesaleEnabled &&
    configuredWholesaleUnit ===
      "SET" &&
    Number(
      wholesaleConfig?.setSize || 0
    ) > 0;

  const pieceWholesaleEnabled =
    wholesaleEnabled &&
    configuredWholesaleUnit ===
      "PIECE";

  /*
   * Backward compatibility:
   *
   * Older products do not have
   * wholesaleConfiguration.
   *
   * Such products continue to work
   * as PIECE wholesale.
   */
  const effectiveWholesaleUnit =
    wholesaleEnabled
      ? wholesaleUnit
      : "PIECE";

  /* =======================================================
     SET INFORMATION
  ======================================================= */

  const piecesPerSet =
    setEnabled
      ? Number(
          wholesaleConfig?.setSize || 0
        )
      : 0;

  const setName =
    setEnabled
      ? wholesaleConfig?.setName ||
        "Wholesale Set"
      : "";

  const setBreakAllowed =
    setEnabled
      ? wholesaleConfig?.setBreakAllowed !==
        false
      : true;

  const setComposition =
    setEnabled
      ? wholesaleConfig?.composition || []
      : [];

  const wholesaleMoq =
    setEnabled
      ? Math.max(
          1,
          Number(
            wholesaleConfig?.moqSets ||
              product?.moq ||
              1
          )
        )
      : Math.max(
          1,
          Number(
            product?.moq || 1
          )
        );

  /* =======================================================
     WHOLESALE TIERS
  ======================================================= */

  const activeWholesaleTiers =
    wholesaleEnabled
      ? (
          wholesaleConfig?.tiers?.length
            ? wholesaleConfig.tiers
            : product?.wholesaleTiers || []
        )
      : product?.wholesaleTiers || [];

  const wholesalePrice =
    useMemo(() => {
      if (!product) {
        return 0;
      }

      let price =
        wholesaleEnabled &&
        wholesaleConfig?.tiers?.length
          ? Number(
              wholesaleConfig.tiers[0]
                ?.price || 0
            )
          : Number(
              product.wholesalePrice || 0
            );

      const tiers =
        [...activeWholesaleTiers]
          .filter(
            (tier) =>
              Number(
                tier.minQuantity
              ) > 0 &&
              Number(tier.price) > 0
          )
          .sort(
            (a, b) =>
              Number(b.minQuantity) -
              Number(a.minQuantity)
          );

      for (const tier of tiers) {
        const min =
          Number(
            tier.minQuantity
          );

        const max =
          tier.maxQuantity ===
            undefined ||
          tier.maxQuantity === null
            ? undefined
            : Number(
                tier.maxQuantity
              );

        if (
          quantity >= min &&
          (
            max === undefined ||
            quantity <= max
          )
        ) {
          price =
            Number(tier.price);
          break;
        }
      }

      return price;
    }, [
      product,
      quantity,
      wholesaleEnabled,
      wholesaleConfig,
      activeWholesaleTiers,
    ]);

  /* =======================================================
     SELECTED PRICE
  ======================================================= */

  const selectedPrice =
    pricingType === "wholesale"
      ? wholesalePrice
      : product?.retailPrice ?? 0;

  /* =======================================================
     PRICE UNIT LABEL
  ======================================================= */

  const priceUnitLabel =
    pricingType === "wholesale" &&
    effectiveWholesaleUnit === "SET"
      ? "per Set"
      : "per Piece";

  /* =======================================================
     ACTUAL PIECES
  ======================================================= */

  const actualPieceQuantity =
    pricingType === "wholesale" &&
    effectiveWholesaleUnit ===
      "SET"
      ? quantity *
        piecesPerSet
      : quantity;

  /* =======================================================
     DISCOUNT
  ======================================================= */

  const discount =
    product &&
    product.mrp > product.retailPrice
      ? Math.round(
          (
            (product.mrp -
              product.retailPrice) /
            product.mrp
          ) * 100
        )
      : 0;

  /* =======================================================
     DISPLAY WHOLESALE MOQ
  ======================================================= */

  const displayedWholesaleMoq =
    effectiveWholesaleUnit === "SET"
      ? `${wholesaleMoq} ${
          wholesaleMoq === 1
            ? "Set"
            : "Sets"
        }`
      : `${wholesaleMoq} ${
          wholesaleMoq === 1
            ? "Piece"
            : "Pieces"
        }`;

  /* =======================================================
     CAN BUY RETAIL
  ======================================================= */

  const canBuyRetail =
    Boolean(product) &&
    (
      !product?.sellingMode ||
      product.sellingMode ===
        "PIECE" ||
      product.sellingMode ===
        "BOTH"
    );

  /* =======================================================
     CAN BUY WHOLESALE
  ======================================================= */

  const canBuyWholesale =
    Boolean(product) &&
    wholesaleEnabled;

  /* =======================================================
     WHOLESALE UNIT SELECTION
  ======================================================= */

  function selectWholesaleUnit(
    unit: WholesaleUnit
  ) {
    if (!product) {
      return;
    }

    setPricingType("wholesale");
    setWholesaleUnit(unit);

    const nextMoq =
      unit === "SET"
        ? Math.max(
            1,
            Number(
              wholesaleConfig?.moqSets ||
                product.moq ||
                1
            )
          )
        : Math.max(
            1,
            Number(
              product.moq || 1
            )
          );

    setQuantity(
      Math.min(
        nextMoq,
        product.stock
      )
    );

    setCartMessage("");
  }

  /* =======================================================
     RETAIL SELECTION
  ======================================================= */

  function selectRetail() {
    setPricingType("retail");
    setWholesaleUnit("PIECE");
    setQuantity(1);
    setCartMessage("");
  }

  /* =======================================================
     WHOLESALE DEFAULT
  ======================================================= */

  useEffect(() => {
    if (!product) {
      return;
    }

    if (
      !canBuyRetail &&
      canBuyWholesale
    ) {
      setPricingType(
        "wholesale"
      );
    }

    if (
      wholesaleConfig?.saleUnit
    ) {
      setWholesaleUnit(
        wholesaleConfig.saleUnit
      );
    }
  }, [
    product,
    canBuyRetail,
    canBuyWholesale,
    wholesaleConfig,
  ]);

  /* =======================================================
     ADD TO CART
  ======================================================= */

  async function handleAddToCart() {
    if (!product) {
      return;
    }

    if (!user) {
      router.push(
        `/login?redirect=/products/${product.slug}`
      );

      return;
    }

    if (product.stock <= 0) {
      setCartMessage(
        "This product is currently out of stock."
      );

      return;
    }

    if (
      pricingType ===
      "wholesale"
    ) {
      if (!wholesaleEnabled) {
        setCartMessage(
          "Wholesale is not available for this product."
        );

        return;
      }

      const minimumQuantity =
        effectiveWholesaleUnit ===
        "SET"
          ? wholesaleMoq
          : Math.max(
              1,
              Number(
                product.moq || 1
              )
            );

      if (
        quantity <
        minimumQuantity
      ) {
        setCartMessage(
          effectiveWholesaleUnit ===
            "SET"
            ? `Wholesale minimum quantity is ${minimumQuantity} sets.`
            : `Wholesale minimum quantity is ${minimumQuantity} pieces.`
        );

        return;
      }
    }

    /*
     * For SET products, product.stock is treated
     * as available SET quantity on the product page.
     *
     * Final component-level inventory is checked
     * securely during checkout/order creation.
     */
    if (
      quantity >
      product.stock
    ) {
      setCartMessage(
        effectiveWholesaleUnit ===
          "SET"
          ? `Only ${product.stock} sets are currently available.`
          : `Only ${product.stock} pieces are currently available.`
      );

      return;
    }

    try {
      setAddingToCart(true);
      setCartMessage("");

      const isSet =
        pricingType ===
          "wholesale" &&
        effectiveWholesaleUnit ===
          "SET";

      await addToCart(
        user.uid,
        {
          id: product.id,

          name: product.name,

          slug: product.slug,

          sellerId:
            product.sellerId,

          sellerName:
            product.sellerName,

          image:
            product.images[0] || "",

          mrp: product.mrp,

          retailPrice:
            product.retailPrice,

          wholesalePrice:
            product.wholesalePrice,

          wholesaleTiers:
            activeWholesaleTiers || [],

          moq:
            pricingType ===
              "wholesale" &&
            effectiveWholesaleUnit ===
              "SET"
              ? wholesaleMoq
              : product.moq,

          pricingType,

          stock:
            product.stock,

          sellingMode:
            product.sellingMode,

          wholesaleUnit:
            pricingType ===
            "wholesale"
              ? effectiveWholesaleUnit
              : undefined,

          piecesPerSet:
            isSet
              ? piecesPerSet
              : undefined,

          setName:
            isSet
              ? setName
              : undefined,

          setBreakAllowed:
            isSet
              ? setBreakAllowed
              : undefined,

          setComposition:
            isSet
              ? setComposition
              : undefined,

          isSet,
        },
        quantity
      );

      setCartMessage(
        isSet
          ? `${quantity} ${
              quantity === 1
                ? "set"
                : "sets"
            } added to cart successfully.`
          : "Product added to cart successfully."
      );
    } catch (error) {
      console.error(
        "Failed to add product to cart:",
        error
      );

      setCartMessage(
        error instanceof Error
          ? error.message
          : "Could not add product to cart. Please try again."
      );
    } finally {
      setAddingToCart(false);
    }
  }

  /* =======================================================
     BUY NOW
  ======================================================= */

  async function handleBuyNow() {
    if (!product) {
      return;
    }

    if (!user) {
      router.push(
        `/login?redirect=/products/${product.slug}`
      );

      return;
    }

    await handleAddToCart();

    /*
     * Existing cart flow is preserved.
     */
    setTimeout(() => {
      router.push("/cart");
    }, 400);
  }

  /* =======================================================
     LOADING
  ======================================================= */

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
              Loading product...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =======================================================
     PRODUCT NOT FOUND
  ======================================================= */

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <div className="text-5xl">
              📦
            </div>

            <h1 className="mt-4 text-2xl font-black">
              Product not found
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              This product may have been removed or is no longer available.
            </p>

            <Link
              href="/products"
              className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
            >
              Browse Products
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =======================================================
     MAIN IMAGE
  ======================================================= */

  const mainImage =
    product.images[0];

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
      <Header />

      <main>
        {/* =================================================
            BREADCRUMB
        ================================================= */}

        <div className="mx-auto max-w-7xl px-4 pt-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <Link
              href="/"
              className="hover:text-black"
            >
              Home
            </Link>

            <span>›</span>

            <Link
              href="/products"
              className="hover:text-black"
            >
              Products
            </Link>

            <span>›</span>

            <span className="font-semibold text-gray-700">
              {product.name}
            </span>
          </div>
        </div>

        {/* =================================================
            PRODUCT
        ================================================= */}

        <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
            {/* =================================================
                IMAGE
            ================================================= */}

            <div>
              <div className="relative aspect-square overflow-hidden rounded-3xl border border-gray-200 bg-white">
                {mainImage ? (
                  <Image
                    src={mainImage}
                    alt={product.name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-8xl">
                    📦
                  </div>
                )}

                {product.bestSeller && (
                  <span className="absolute left-4 top-4 rounded-full bg-black px-3 py-1.5 text-[10px] font-bold text-white">
                    Bestseller
                  </span>
                )}

                {discount > 0 && (
                  <span className="absolute bottom-4 left-4 rounded-lg bg-white px-3 py-2 text-xs font-black shadow-lg">
                    {discount}% OFF
                  </span>
                )}
              </div>

              {product.images.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {product.images
                    .slice(0, 5)
                    .map(
                      (
                        image,
                        index
                      ) => (
                        <div
                          key={`${image}-${index}`}
                          className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-white"
                        >
                          <Image
                            src={image}
                            alt={`${product.name} ${
                              index + 1
                            }`}
                            fill
                            sizes="100px"
                            className="object-cover"
                          />
                        </div>
                      )
                    )}
                </div>
              )}
            </div>

            {/* =================================================
                DETAILS
            ================================================= */}

            <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                  {product.categoryName ||
                    product.categoryId}
                </span>

                {product.sellerVerified && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold text-gray-700">
                    ✓ Verified Seller
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                {product.name}
              </h1>

              {product.rating !==
                undefined && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-black">
                    ★{" "}
                    {product.rating}
                  </span>

                  {product.reviewsCount !==
                    undefined && (
                    <span className="text-xs text-gray-400">
                      {product.reviewsCount.toLocaleString(
                        "en-IN"
                      )}{" "}
                      reviews
                    </span>
                  )}
                </div>
              )}

              {product.description && (
                <p className="mt-5 text-sm leading-6 text-gray-600">
                  {product.description}
                </p>
              )}

              {/* =================================================
                  BUYING MODE
              ================================================= */}

              <div className="mt-6">
                <p className="mb-2 text-xs font-black">
                  Choose buying option
                </p>

                <div
                  className={`grid gap-2 ${
                    canBuyRetail &&
                    canBuyWholesale
                      ? "grid-cols-2"
                      : "grid-cols-1"
                  }`}
                >
                  {/* RETAIL */}

                  {canBuyRetail && (
                    <button
                      type="button"
                      onClick={
                        selectRetail
                      }
                      className={`rounded-xl border p-3 text-left transition ${
                        pricingType ===
                        "retail"
                          ? "border-black bg-black text-white"
                          : "border-gray-200 bg-white hover:border-black"
                      }`}
                    >
                      <div className="text-lg">
                        🛍️
                      </div>

                      <p className="mt-1 text-xs font-black">
                        Retail
                      </p>

                      <p
                        className={`mt-1 text-[9px] ${
                          pricingType ===
                          "retail"
                            ? "text-gray-300"
                            : "text-gray-400"
                        }`}
                      >
                        Buy single pieces
                      </p>
                    </button>
                  )}

                  {/* WHOLESALE */}

                  {canBuyWholesale && (
                    <button
                      type="button"
                      onClick={() => {
                        setPricingType(
                          "wholesale"
                        );

                        if (
                          configuredWholesaleUnit
                        ) {
                          setWholesaleUnit(
                            configuredWholesaleUnit
                          );

                          const minimum =
                            configuredWholesaleUnit ===
                            "SET"
                              ? wholesaleMoq
                              : Math.max(
                                  1,
                                  Number(
                                    product.moq ||
                                      1
                                  )
                                );

                          setQuantity(
                            Math.min(
                              minimum,
                              product.stock
                            )
                          );
                        } else {
                          setWholesaleUnit(
                            "PIECE"
                          );

                          setQuantity(
                            Math.min(
                              Math.max(
                                1,
                                Number(
                                  product.moq ||
                                    1
                                )
                              ),
                              product.stock
                            )
                          );
                        }

                        setCartMessage("");
                      }}
                      className={`rounded-xl border p-3 text-left transition ${
                        pricingType ===
                        "wholesale"
                          ? "border-black bg-black text-white"
                          : "border-gray-200 bg-white hover:border-black"
                      }`}
                    >
                      <div className="text-lg">
                        📦
                      </div>

                      <p className="mt-1 text-xs font-black">
                        Wholesale
                      </p>

                      <p
                        className={`mt-1 text-[9px] ${
                          pricingType ===
                          "wholesale"
                            ? "text-gray-300"
                            : "text-gray-400"
                        }`}
                      >
                        MOQ{" "}
                        {displayedWholesaleMoq}
                      </p>
                    </button>
                  )}
                </div>
              </div>

              {/* =================================================
                  WHOLESALE UNIT
              ================================================= */}

              {pricingType ===
                "wholesale" &&
                canBuyWholesale &&
                (
                  configuredWholesaleUnit ===
                    "SET" ||
                  configuredWholesaleUnit ===
                    "PIECE"
                ) && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-black">
                      Wholesale selling unit
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {/* PIECE */}

                      {configuredWholesaleUnit ===
                        "PIECE" && (
                        <button
                          type="button"
                          onClick={() =>
                            selectWholesaleUnit(
                              "PIECE"
                            )
                          }
                          className={`rounded-xl border p-3 text-left ${
                            wholesaleUnit ===
                            "PIECE"
                              ? "border-black bg-black text-white"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <p className="text-xs font-black">
                            Per Piece
                          </p>

                          <p
                            className={`mt-1 text-[9px] ${
                              wholesaleUnit ===
                              "PIECE"
                                ? "text-gray-300"
                                : "text-gray-400"
                            }`}
                          >
                            Wholesale by piece
                          </p>
                        </button>
                      )}

                      {/* SET */}

                      {configuredWholesaleUnit ===
                        "SET" && (
                        <button
                          type="button"
                          onClick={() =>
                            selectWholesaleUnit(
                              "SET"
                            )
                          }
                          className={`rounded-xl border p-3 text-left ${
                            wholesaleUnit ===
                            "SET"
                              ? "border-black bg-black text-white"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <p className="text-xs font-black">
                            Per Set
                          </p>

                          <p
                            className={`mt-1 text-[9px] ${
                              wholesaleUnit ===
                              "SET"
                                ? "text-gray-300"
                                : "text-gray-400"
                            }`}
                          >
                            Wholesale complete set
                          </p>
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* =================================================
                  SET INFORMATION
              ================================================= */}

              {pricingType ===
                "wholesale" &&
                effectiveWholesaleUnit ===
                  "SET" &&
                setEnabled && (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black">
                          {setName}
                        </p>

                        <p className="mt-1 text-[10px] text-gray-500">
                          1 Set ={" "}
                          {piecesPerSet}{" "}
                          Pieces
                        </p>
                      </div>

                      <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-bold text-white">
                        SET
                      </span>
                    </div>

                    {setComposition.length >
                      0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          Set Composition
                        </p>

                        <div className="mt-2 space-y-2">
                          {setComposition.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={`${item.value}-${item.variantType}-${index}`}
                                className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                              >
                                <div>
                                  <p className="text-[10px] font-bold">
                                    {item.value}
                                  </p>

                                  <p className="text-[9px] text-gray-400">
                                    {item.variantType.replace(
                                      "_",
                                      " + "
                                    )}
                                  </p>
                                </div>

                                <span className="text-[10px] font-black">
                                  ×{" "}
                                  {
                                    item.quantity
                                  }
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                      <span className="text-sm">
                        🔒
                      </span>

                      <p className="text-[10px] font-semibold text-gray-600">
                        {setBreakAllowed
                          ? "Set components can be sold separately."
                          : "Complete set required — set cannot be broken."}
                      </p>
                    </div>
                  </div>
                )}

              {/* =================================================
                  PRICE
              ================================================= */}

              <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {pricingType ===
                  "wholesale"
                    ? "Wholesale Price"
                    : "Retail Price"}
                </p>

                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <span className="text-3xl font-black">
                    ₹
                    {selectedPrice.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                  <span className="mb-1 text-[10px] font-bold text-gray-500">
                    {priceUnitLabel}
                  </span>

                  {pricingType ===
                    "retail" &&
                    product.mrp >
                      product.retailPrice && (
                      <span className="mb-1 text-sm text-gray-400 line-through">
                        ₹
                        {product.mrp.toLocaleString(
                          "en-IN"
                        )}
                      </span>
                    )}

                  {pricingType ===
                    "retail" &&
                    discount > 0 && (
                    <span className="mb-1 text-xs font-black">
                      {discount}% OFF
                    </span>
                  )}
                </div>

                {pricingType ===
                  "wholesale" && (
                  <p className="mt-2 text-[10px] text-gray-500">
                    Price updates automatically according to quantity.
                  </p>
                )}
              </div>

              {/* =================================================
                  WHOLESALE TIERS
              ================================================= */}

              {pricingType ===
                "wholesale" &&
                activeWholesaleTiers.length >
                  0 && (
                  <div className="mt-4 rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black">
                        Wholesale Pricing
                      </p>

                      <span className="text-[9px] font-bold text-gray-400">
                        MOQ{" "}
                        {displayedWholesaleMoq}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {activeWholesaleTiers.map(
                        (
                          tier,
                          index
                        ) => {
                          const isSelected =
                            quantity >=
                              Number(
                                tier.minQuantity
                              ) &&
                            (
                              tier.maxQuantity ===
                                undefined ||
                              quantity <=
                                Number(
                                  tier.maxQuantity
                                )
                            );

                          return (
                            <button
                              type="button"
                              key={`${tier.minQuantity}-${index}`}
                              onClick={() => {
                                setPricingType(
                                  "wholesale"
                                );

                                const nextQuantity =
                                  Math.max(
                                    Number(
                                      tier.minQuantity
                                    ),
                                    effectiveWholesaleUnit ===
                                      "SET"
                                      ? wholesaleMoq
                                      : Number(
                                          product.moq ||
                                            1
                                        )
                                  );

                                setQuantity(
                                  Math.min(
                                    nextQuantity,
                                    product.stock
                                  )
                                );

                                setCartMessage(
                                  ""
                                );
                              }}
                              className={`rounded-xl border p-3 text-center transition ${
                                isSelected
                                  ? "border-black bg-black text-white"
                                  : "border-gray-200 bg-gray-50 hover:border-black"
                              }`}
                            >
                              <p className="text-[9px] opacity-60">
                                {tier.maxQuantity
                                  ? `${tier.minQuantity}-${tier.maxQuantity}`
                                  : `${tier.minQuantity}+`}{" "}
                                {effectiveWholesaleUnit ===
                                "SET"
                                  ? "sets"
                                  : "pcs"}
                              </p>

                              <p className="mt-1 text-sm font-black">
                                ₹
                                {Number(
                                  tier.price
                                ).toLocaleString(
                                  "en-IN"
                                )}
                              </p>

                              <p className="mt-0.5 text-[8px] opacity-60">
                                {effectiveWholesaleUnit ===
                                "SET"
                                  ? "per set"
                                  : "per piece"}
                              </p>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

              {/* =================================================
                  QUANTITY
              ================================================= */}

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black">
                    Quantity
                  </p>

                  <p className="text-[10px] text-gray-400">
                    {product.stock}{" "}
                    {pricingType ===
                      "wholesale" &&
                    effectiveWholesaleUnit ===
                      "SET"
                      ? "sets"
                      : "pieces"}{" "}
                    available
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  {/* MINUS */}

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        Math.max(
                          pricingType ===
                            "wholesale"
                            ? wholesaleMoq
                            : 1,
                          quantity - 1
                        )
                      )
                    }
                    disabled={
                      quantity <=
                      (
                        pricingType ===
                        "wholesale"
                          ? wholesaleMoq
                          : 1
                      )
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-lg font-bold disabled:opacity-40"
                  >
                    −
                  </button>

                  {/* CURRENT */}

                  <div className="flex h-11 min-w-16 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-black">
                    {quantity}
                  </div>

                  {/* PLUS */}

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        Math.min(
                          product.stock,
                          quantity + 1
                        )
                      )
                    }
                    disabled={
                      quantity >=
                      product.stock
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-lg font-bold disabled:opacity-40"
                  >
                    +
                  </button>

                  <div className="ml-1">
                    <p className="text-[10px] font-bold text-gray-500">
                      {pricingType ===
                        "wholesale" &&
                      effectiveWholesaleUnit ===
                        "SET"
                        ? "Sets"
                        : "Pieces"}
                    </p>

                    {pricingType ===
                      "wholesale" &&
                      effectiveWholesaleUnit ===
                        "SET" && (
                      <p className="text-[9px] text-gray-400">
                        ={" "}
                        {actualPieceQuantity}{" "}
                        pieces
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* =================================================
                  SELLER
              ================================================= */}

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-lg">
                    🏪
                  </div>

                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-400">
                      Sold by
                    </p>

                    <p className="mt-0.5 text-sm font-black">
                      {product.sellerName ||
                        "ANJIVO Seller"}
                    </p>
                  </div>
                </div>

                {product.sellerVerified && (
                  <span className="text-[10px] font-bold">
                    ✓ Verified
                  </span>
                )}
              </div>

              {/* =================================================
                  CART MESSAGE
              ================================================= */}

              {cartMessage && (
                <div className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-700">
                  {cartMessage}
                </div>
              )}

              {/* =================================================
                  ACTIONS
              ================================================= */}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={
                    handleAddToCart
                  }
                  disabled={
                    addingToCart ||
                    product.stock <= 0
                  }
                  className="rounded-xl border border-black bg-white py-3.5 text-sm font-bold text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {addingToCart
                    ? "Adding..."
                    : "🛒 Add to Cart"}
                </button>

                <button
                  type="button"
                  onClick={
                    handleBuyNow
                  }
                  disabled={
                    addingToCart ||
                    product.stock <= 0
                  }
                  className="rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Buy Now
                </button>
              </div>

              {/* =================================================
                  VIEW CART
              ================================================= */}

              {cartMessage.includes(
                "successfully"
              ) && (
                <Link
                  href="/cart"
                  className="mt-3 block rounded-xl border border-gray-200 bg-gray-50 py-3 text-center text-xs font-bold hover:border-black"
                >
                  View Cart →
                </Link>
              )}

              {/* =================================================
                  TRUST
              ================================================= */}

              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-5">
                <div className="text-center">
                  <div>🔒</div>

                  <p className="mt-1 text-[9px] font-bold text-gray-500">
                    Secure
                  </p>
                </div>

                <div className="text-center">
                  <div>✓</div>

                  <p className="mt-1 text-[9px] font-bold text-gray-500">
                    Verified
                  </p>
                </div>

                <div className="text-center">
                  <div>📦</div>

                  <p className="mt-1 text-[9px] font-bold text-gray-500">
                    Tracked
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
