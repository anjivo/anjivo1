import { NextResponse } from "next/server";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type PricingType = "retail" | "wholesale";
type WholesaleUnit = "PIECE" | "SET";

type OrderItemRequest = {
  productId: string;
  sellerId: string;
  quantity: number;
  pricingType: PricingType;
  wholesaleUnit?: WholesaleUnit;
  piecesPerSet?: number;
  setName?: string;
  setBreakAllowed?: boolean;
  setComposition?: SetCompositionItem[];
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariantValue?: string;
};

type ShippingAddress = {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

type SetCompositionItem = {
  variantType?: string;
  value?: string;
  quantity: number;
  size?: string;
  color?: string;
};

type WholesaleConfiguration = {
  enabled?: boolean;
  saleUnit?: WholesaleUnit;
  setBreakAllowed?: boolean;
  setSize?: number;
  setName?: string;
  composition?: SetCompositionItem[];
  moqSets?: number;
  priceUnit?: WholesaleUnit;
  tiers?: WholesaleTier[];
};

type ProductVariantRecord = {
  id?: string;
  sku?: string;
  name?: string;
  variantType?: string;
  size?: string;
  color?: string;
  value?: string;
  price?: number;
  retailPrice?: number;
  mrp?: number;
  stock?: number;
  status?: string;
  images?: string[];
};

type ProductData = {
  id: string;
  name: string;
  slug?: string;
  sellerId: string;
  sellerName?: string;
  status: "active" | "draft" | "out_of_stock" | "blocked";
  stock: number;
  mrp: number;
  retailPrice: number;
  wholesalePrice: number;
  moq: number;
  wholesaleTiers: WholesaleTier[];
  wholesaleConfiguration?: WholesaleConfiguration;
  variantConfiguration?: {
    enabled?: boolean;
    type?: string;
    variants?: ProductVariantRecord[];
  };
  sellingMode?: "PIECE" | "SET" | "BOTH";
  images: string[];
};

type OrderLineItem = {
  productId: string;
  sellerId: string;
  sellerName: string;
  productName: string;
  productSlug: string;
  image: string;
  quantity: number;
  pricingType: PricingType;
  mrp: number;
  unitPrice: number;
  subtotal: number;
  moq: number;

  wholesaleUnit?: WholesaleUnit;
  piecesPerSet?: number;
  setName?: string;
  setBreakAllowed?: boolean;
  setComposition?: SetCompositionItem[];
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariantValue?: string;
};

type SellerGroup = {
  sellerId: string;
  sellerName: string;
  items: OrderLineItem[];
  subtotal: number;
};

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positiveInteger(value: unknown): boolean {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function normalizeTiers(value: unknown): WholesaleTier[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const tier = raw as Record<string, unknown>;
      const minQuantity = Number(tier.minQuantity);
      const price = Number(tier.price);
      const maxQuantity =
        tier.maxQuantity === undefined || tier.maxQuantity === null
          ? undefined
          : Number(tier.maxQuantity);

      if (!Number.isInteger(minQuantity) || minQuantity <= 0) return null;
      if (!Number.isFinite(price) || price <= 0) return null;
      if (
        maxQuantity !== undefined &&
        (!Number.isInteger(maxQuantity) || maxQuantity < minQuantity)
      ) {
        return null;
      }

      return {
        minQuantity,
        ...(maxQuantity !== undefined ? { maxQuantity } : {}),
        price,
      };
    })
    .filter((tier): tier is WholesaleTier => tier !== null)
    .sort((a, b) => b.minQuantity - a.minQuantity);
}

function getTierForQuantity(
  tiers: WholesaleTier[],
  quantity: number
): WholesaleTier | null {
  return (
    tiers.find(
      (tier) =>
        quantity >= tier.minQuantity &&
        (tier.maxQuantity === undefined || quantity <= tier.maxQuantity)
    ) || null
  );
}

function normalizeComposition(value: unknown): SetCompositionItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) return null;

      return {
        ...(item.variantType
          ? { variantType: String(item.variantType) }
          : {}),
        ...(item.value ? { value: String(item.value) } : {}),
        quantity,
        ...(item.size ? { size: String(item.size) } : {}),
        ...(item.color ? { color: String(item.color) } : {}),
      };
    })
    .filter((item): item is SetCompositionItem => item !== null);
}

function compositionSize(composition: SetCompositionItem[]): number {
  return composition.reduce((sum, item) => sum + item.quantity, 0);
}

function normalizeProduct(
  id: string,
  data: Record<string, unknown>
): ProductData {
  const rawStatus = data.status;
  const status =
    rawStatus === "draft" ||
    rawStatus === "out_of_stock" ||
    rawStatus === "blocked"
      ? rawStatus
      : "active";

  return {
    id,
    name: stringValue(data.name, "Product"),
    slug: stringValue(data.slug),
    sellerId: stringValue(data.sellerId),
    sellerName: stringValue(data.sellerName, "ANJIVO Seller"),
    status,
    stock: Math.max(0, Math.floor(numberValue(data.stock))),
    mrp: numberValue(data.mrp),
    retailPrice: numberValue(data.retailPrice),
    wholesalePrice: numberValue(data.wholesalePrice),
    moq: Math.max(1, Math.floor(numberValue(data.moq, 1))),
    wholesaleTiers: normalizeTiers(data.wholesaleTiers),
    wholesaleConfiguration:
      data.wholesaleConfiguration &&
      typeof data.wholesaleConfiguration === "object"
        ? (data.wholesaleConfiguration as WholesaleConfiguration)
        : undefined,
    variantConfiguration:
      data.variantConfiguration &&
      typeof data.variantConfiguration === "object"
        ? (data.variantConfiguration as ProductData["variantConfiguration"])
        : undefined,
    sellingMode:
      data.sellingMode === "PIECE" ||
      data.sellingMode === "SET" ||
      data.sellingMode === "BOTH"
        ? data.sellingMode
        : undefined,
    images: Array.isArray(data.images)
      ? data.images.filter((x): x is string => typeof x === "string")
      : [],
  };
}

function validateShippingAddress(address: unknown): ShippingAddress {
  if (!address || typeof address !== "object") {
    throw new Error("Delivery address is required.");
  }

  const value = address as Record<string, unknown>;
  const fullName = stringValue(value.fullName);
  const addressLine1 = stringValue(value.addressLine1);
  const addressLine2 = stringValue(value.addressLine2);
  const city = stringValue(value.city);
  const state = stringValue(value.state);
  const pincode = stringValue(value.pincode);

  if (fullName.length < 2) throw new Error("Please enter a valid customer name.");
  if (addressLine1.length < 5) throw new Error("Please enter a complete delivery address.");
  if (city.length < 2) throw new Error("Please enter a valid city.");
  if (state.length < 2) throw new Error("Please enter a valid state.");
  if (!/^\d{6}$/.test(pincode)) throw new Error("Please enter a valid 6 digit pincode.");

  return {
    fullName,
    addressLine1,
    ...(addressLine2 ? { addressLine2 } : {}),
    city,
    state,
    pincode,
  };
}

async function requireAdmin(request: Request): Promise<string> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Authentication required.");
  }

  const token = authorization.slice(7).trim();
  if (!token) throw new Error("Authentication token missing.");

  const decoded = await adminAuth.verifyIdToken(token);
  const userSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
  const userData = userSnapshot.data() ?? {};
  const role = stringValue(userData.role).toUpperCase();
  const accountStatus = stringValue(userData.accountStatus).toLowerCase();

  if (
    !userSnapshot.exists ||
    !["ADMIN", "SUPERADMIN"].includes(role) ||
    accountStatus === "blocked" ||
    accountStatus === "inactive"
  ) {
    throw new Error("Admin access required.");
  }

  return decoded.uid;
}

function getWholesaleConfig(
  product: ProductData
): WholesaleConfiguration | null {
  const config = product.wholesaleConfiguration;
  if (!config || config.enabled === false) return null;
  return config;
}

/**
 * Resolve PIECE wholesale pricing from the canonical configuration first,
 * then from legacy product-level tiers/wholesalePrice.
 *
 * SET-only products must never be treated as PIECE products.
 */
function getPieceWholesaleConfiguration(
  product: ProductData
): WholesaleConfiguration | null {
  const rawConfig = product.wholesaleConfiguration;

  // An explicitly disabled wholesale configuration must stay disabled.
  if (rawConfig?.enabled === false) return null;

  const configured = getWholesaleConfig(product);

  if (configured?.saleUnit === "SET" || product.sellingMode === "SET") {
    return null;
  }

  if (
    configured?.saleUnit &&
    configured.saleUnit !== "PIECE"
  ) {
    return null;
  }

  const configuredTiers = normalizeTiers(configured?.tiers);
  const legacyTiers = normalizeTiers(product.wholesaleTiers);
  const tiers =
    configuredTiers.length > 0 ? configuredTiers : legacyTiers;

  // Do not manufacture a PIECE wholesale configuration without any
  // usable wholesale price source.
  if (tiers.length === 0 && product.wholesalePrice <= 0) {
    return null;
  }

  return {
    ...(configured || {}),
    enabled: true,
    saleUnit: "PIECE",
    tiers,
  };
}

function validateSetProduct(product: ProductData) {
  const config = getWholesaleConfig(product);

  if (!config || config.saleUnit !== "SET") {
    throw new Error(
      `${product.name}: wholesale set configuration is not available.`
    );
  }

  const setSize = Number(config.setSize);
  if (!Number.isInteger(setSize) || setSize <= 0) {
    throw new Error(`${product.name}: invalid set size configuration.`);
  }

  const composition = normalizeComposition(config.composition);
  if (composition.length === 0) {
    throw new Error(`${product.name}: set composition is missing.`);
  }

  if (compositionSize(composition) !== setSize) {
    throw new Error(
      `${product.name}: set composition does not match set size.`
    );
  }

  return {
    config,
    setSize,
    composition,
    moqSets: Math.max(1, Math.floor(numberValue(config.moqSets, 1))),
    setBreakAllowed: config.setBreakAllowed === true,
    setName: stringValue(config.setName),
  };
}

function getAvailableSets(product: ProductData, setSize: number): number {
  return Math.floor(Math.max(0, product.stock) / setSize);
}

export async function POST(request: Request) {
  try {
    const adminUid = await requireAdmin(request);
    const body = await request.json();

    const paymentMethod = "COD";
    const customerName = stringValue(body?.customerName);
    const customerEmail = stringValue(body?.customerEmail).toLowerCase();

    if (customerName.length < 2 || customerName.length > 120) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid customer name." },
        { status: 400 }
      );
    }

    if (customerEmail && (
      customerEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    )) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const shippingAddress = validateShippingAddress(
      body?.shippingAddress
    );

    const rawItems = body?.items;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Your cart is empty." },
        { status: 400 }
      );
    }

    if (rawItems.length > 100) {
      return NextResponse.json(
        { success: false, message: "Too many order items." },
        { status: 400 }
      );
    }

    /*
     * ============================================================
     * 2. NORMALIZE REQUEST
     * ============================================================
     *
     * Price is NEVER accepted from the client.
     * Set metadata is also revalidated against Firestore.
     */
    const requestedItems: OrderItemRequest[] = [];
    const seenKeys = new Set<string>();

    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") {
        throw new Error("Invalid order item.");
      }

      const item = rawItem as Record<string, unknown>;

      const productId = stringValue(item.productId ?? item.id);
      const sellerId = stringValue(item.sellerId);
      const quantity = Math.floor(numberValue(item.quantity));

      const pricingType: PricingType =
        item.pricingType === "wholesale" ? "wholesale" : "retail";

      const wholesaleUnit =
        item.wholesaleUnit === "SET" || item.wholesaleUnit === "PIECE"
          ? item.wholesaleUnit
          : undefined;

      const piecesPerSet =
        item.piecesPerSet !== undefined
          ? Math.floor(numberValue(item.piecesPerSet))
          : undefined;

      const setName =
        typeof item.setName === "string"
          ? item.setName.trim()
          : undefined;

      const setBreakAllowed =
        typeof item.setBreakAllowed === "boolean"
          ? item.setBreakAllowed
          : undefined;

      const setComposition = normalizeComposition(
        item.setComposition
      );
      const variantId = stringValue(item.variantId);
      const variantSku = stringValue(item.variantSku);
      const variantName = stringValue(item.variantName);
      const selectedSize = stringValue(item.selectedSize);
      const selectedColor = stringValue(item.selectedColor);
      const selectedVariantValue = stringValue(item.selectedVariantValue);

      if (!productId || !sellerId) {
        throw new Error("Invalid product or seller information.");
      }

      if (!positiveInteger(quantity)) {
        throw new Error("Invalid product quantity.");
      }

      const key = [
        productId,
        sellerId,
        pricingType,
        wholesaleUnit || "NONE",
        piecesPerSet || 0,
        setName || "",
        variantId || "NO_VARIANT",
        variantSku || "",
        variantName || "",
        selectedSize || "",
        selectedColor || "",
        selectedVariantValue || "",
      ].join("|");

      if (seenKeys.has(key)) {
        throw new Error(
          "Duplicate order item detected. Please refresh your cart."
        );
      }

      seenKeys.add(key);

      requestedItems.push({
        productId,
        sellerId,
        quantity,
        pricingType,
        ...(wholesaleUnit ? { wholesaleUnit } : {}),
        ...(piecesPerSet ? { piecesPerSet } : {}),
        ...(setName ? { setName } : {}),
        ...(setBreakAllowed !== undefined ? { setBreakAllowed } : {}),
        ...(setComposition.length > 0 ? { setComposition } : {}),
        ...(variantId ? { variantId } : {}),
        ...(variantSku ? { variantSku } : {}),
        ...(variantName ? { variantName } : {}),
        ...(selectedSize ? { selectedSize } : {}),
        ...(selectedColor ? { selectedColor } : {}),
        ...(selectedVariantValue ? { selectedVariantValue } : {}),
      });
    }

    /*
     * ============================================================
     * 3. ATOMIC FIRESTORE TRANSACTION
     * ============================================================
     *
     * All product reads happen before any writes.
     * Order + sellerOrders + inventory + transaction + audit log
     * are committed together.
     */
    const result = await adminDb.runTransaction(async (transaction) => {
      const products = new Map<string, ProductData>();
      const productRefs = new Map<string, DocumentReference>();
      for (const item of requestedItems) {
        if (products.has(item.productId)) continue;

        const productRef = adminDb
          .collection("products")
          .doc(item.productId);

        const snapshot = await transaction.get(productRef);

        if (!snapshot.exists) {
          throw new Error(
            `Product ${item.productId} no longer exists.`
          );
        }

        products.set(
          item.productId,
          normalizeProduct(
            item.productId,
            snapshot.data() as Record<string, unknown>
          )
        );

        productRefs.set(item.productId, productRef);
      }

      // Admin-created guest orders may use either retail or wholesale pricing.
      // Wholesale eligibility is controlled by the product's server-side
      // configuration and quantity rules, not by a customer account.
      const isWholesaleCustomer = true;

      // Count PIECE quantities across all size/colour variants of each product.
      // This is the server-side source of truth for mixed-variant wholesale pricing.
      const pieceQuantityByProduct = new Map<string, number>();
      for (const item of requestedItems) {
        const product = products.get(item.productId);
        const pieceConfig = product
          ? getPieceWholesaleConfiguration(product)
          : null;

        // Explicit SET lines and SET-only products are excluded. PIECE
        // quantities are combined across all sizes/colours of this product.
        if (pieceConfig && item.wholesaleUnit !== "SET") {
          pieceQuantityByProduct.set(
            item.productId,
            (pieceQuantityByProduct.get(item.productId) || 0) + item.quantity
          );
        }
      }

      /*
       * ----------------------------------------------------------
       * AGGREGATED INVENTORY REQUIREMENTS
       * ----------------------------------------------------------
       *
       * Product stock is currently piece-based.
       * A SET consumes quantity × piecesPerSet.
       */
      const requiredPieces = new Map<string, number>();
      const requiredVariantStock = new Map<string, number>();

      const orderItems: OrderLineItem[] = [];
      const sellerMap = new Map<string, SellerGroup>();

      let subtotal = 0;

      for (const item of requestedItems) {
        const product = products.get(item.productId);

        if (!product) {
          throw new Error("Product validation failed.");
        }

        if (product.sellerId !== item.sellerId) {
          throw new Error(
            `${product.name}: seller information has changed. Please refresh your cart.`
          );
        }

        if (product.status !== "active") {
          throw new Error(
            `${product.name} is currently unavailable.`
          );
        }

        const wholesaleConfigForLine = getWholesaleConfig(product);
        const pieceWholesaleConfigForLine =
          getPieceWholesaleConfiguration(product);
        const combinedPieceQuantity = pieceQuantityByProduct.get(product.id) || 0;
        const automaticPieceWholesale =
          !!pieceWholesaleConfigForLine &&
          item.wholesaleUnit !== "SET" &&
          combinedPieceQuantity >= Math.max(10, product.moq);
        const effectivePricingType: PricingType =
          wholesaleConfigForLine?.saleUnit === "SET"
            ? (item.pricingType === "wholesale" && isWholesaleCustomer ? "wholesale" : "retail")
            : (automaticPieceWholesale || (item.pricingType === "wholesale" && isWholesaleCustomer)
                ? "wholesale"
                : "retail");

        if (
          wholesaleConfigForLine?.saleUnit === "SET" &&
          item.pricingType === "wholesale" &&
          !isWholesaleCustomer
        ) {
          throw new Error("Wholesale set pricing is available only to approved wholesale customers.");
        }

        const variantConfiguration = product.variantConfiguration;
        const variantsEnabled =
          Array.isArray(variantConfiguration?.variants) &&
          variantConfiguration.variants.length > 0;
        let selectedVariant: ProductVariantRecord | undefined;

        if (variantsEnabled) {
          if (!item.variantId) {
            throw new Error(`${product.name}: please select a size/colour variant.`);
          }
          selectedVariant = variantConfiguration!.variants!.find(
            (variant) => stringValue(variant.id) === item.variantId
          );
          if (!selectedVariant) {
            throw new Error(`${product.name}: selected variant no longer exists. Please refresh your cart.`);
          }
          if (!stringValue(selectedVariant.id)) {
            throw new Error(`${product.name}: selected variant configuration is invalid. Please contact support.`);
          }
          if (
            (selectedVariant.status && selectedVariant.status !== "active") ||
            numberValue(selectedVariant.stock) <= 0
          ) {
            throw new Error(`${product.name}: selected variant is out of stock.`);
          }
          const mismatches =
            (item.variantSku && item.variantSku !== stringValue(selectedVariant.sku)) ||
            (item.variantName && item.variantName !== stringValue(selectedVariant.name)) ||
            (item.selectedSize && item.selectedSize !== stringValue(selectedVariant.size)) ||
            (item.selectedColor && item.selectedColor !== stringValue(selectedVariant.color)) ||
            (item.selectedVariantValue && item.selectedVariantValue !== stringValue(selectedVariant.value));
          if (mismatches) {
            throw new Error(`${product.name}: variant details changed. Please refresh your cart.`);
          }
        } else if (item.variantId) {
          throw new Error(`${product.name}: selected variant is not configured. Please refresh your cart.`);
        }

        const currentStock = Math.max(
          0,
          Math.floor(product.stock)
        );

        if (currentStock <= 0) {
          throw new Error(`${product.name} is out of stock.`);
        }

        let stockConsumption = item.quantity;
        let unitPrice = 0;
        let moq = product.moq;

        const lineSnapshot: Partial<OrderLineItem> = {};

        /*
         * ========================================================
         * RETAIL
         * ========================================================
         */
        if (effectivePricingType === "retail") {
          if (product.sellingMode === "SET") {
            throw new Error(
              `${product.name}: retail piece purchase is not available.`
            );
          }

          const configuredVariantPrice = selectedVariant
            ? numberValue(selectedVariant.price, 0)
            : 0;
          const variantPrice =
            configuredVariantPrice > 0
              ? configuredVariantPrice
              : product.retailPrice;
          if (variantPrice <= 0) {
            throw new Error(
              `${product.name}: retail price is not configured.`
            );
          }

          unitPrice = variantPrice;
        }

        /*
         * ========================================================
         * WHOLESALE
         * ========================================================
         */
        else {
          const config =
            item.wholesaleUnit === "SET"
              ? getWholesaleConfig(product)
              : getPieceWholesaleConfiguration(product) ||
                getWholesaleConfig(product);

          if (!config) {
            throw new Error(
              `${product.name}: wholesale configuration is missing.`
            );
          }

          if (config.saleUnit !== "PIECE" && config.saleUnit !== "SET") {
            throw new Error(
              `${product.name}: invalid wholesale unit configuration.`
            );
          }

          /*
           * ------------------------------------------------------
           * WHOLESALE PIECE
           * ------------------------------------------------------
           */
          if (config.saleUnit === "PIECE") {
            if (
              item.wholesaleUnit &&
              item.wholesaleUnit !== "PIECE"
            ) {
              throw new Error(
                `${product.name}: wholesale unit mismatch.`
              );
            }

            moq = Math.max(10, product.moq);

            if (combinedPieceQuantity < moq) {
              // A normal retail order remains retail until the combined threshold is met.
              throw new Error(
                `${product.name}: add at least ${moq} pieces across sizes/colours for wholesale pricing.`
              );
            }

            const tiers = normalizeTiers(
              Array.isArray(config.tiers) && config.tiers.length > 0
                ? config.tiers
                : product.wholesaleTiers
            );

            const tier = getTierForQuantity(
              tiers,
              combinedPieceQuantity
            );
            const fallbackWholesalePrice = numberValue(
              product.wholesalePrice,
              0
            );

            if (!tier && fallbackWholesalePrice <= 0) {
              throw new Error(
                `${product.name}: no wholesale price is configured for ${combinedPieceQuantity} combined pieces.`
              );
            }

            unitPrice = tier?.price ?? fallbackWholesalePrice;
            lineSnapshot.wholesaleUnit = "PIECE";
          }

          /*
           * ------------------------------------------------------
           * WHOLESALE SET / PACK
           * ------------------------------------------------------
           */
          else {
            const setData = validateSetProduct(product);

            if (
              item.wholesaleUnit &&
              item.wholesaleUnit !== "SET"
            ) {
              throw new Error(
                `${product.name}: wholesale unit mismatch.`
              );
            }

            if (
              item.piecesPerSet !== undefined &&
              item.piecesPerSet !== setData.setSize
            ) {
              throw new Error(
                `${product.name}: set size mismatch.`
              );
            }

            if (
              item.setName &&
              setData.setName &&
              item.setName !== setData.setName
            ) {
              throw new Error(
                `${product.name}: set name/configuration mismatch.`
              );
            }

            if (
              item.setBreakAllowed !== undefined &&
              item.setBreakAllowed !== setData.setBreakAllowed
            ) {
              throw new Error(
                `${product.name}: set-break configuration mismatch.`
              );
            }

            if (
              item.setComposition &&
              JSON.stringify(item.setComposition) !==
                JSON.stringify(setData.composition)
            ) {
              throw new Error(
                `${product.name}: set composition has changed. Please refresh your cart.`
              );
            }

            moq = setData.moqSets;

            if (item.quantity < moq) {
              throw new Error(
                `${product.name}: minimum wholesale quantity is ${moq} sets.`
              );
            }

            const availableSets = Math.floor(
              currentStock / setData.setSize
            );

            if (item.quantity > availableSets) {
              throw new Error(
                `${product.name}: only ${availableSets} sets are currently available.`
              );
            }

            const tiers = normalizeTiers(
              setData.config.tiers
            );

            const tier = getTierForQuantity(
              tiers,
              item.quantity
            );

            if (!tier) {
              throw new Error(
                `${product.name}: no wholesale set price tier is available for ${item.quantity} sets.`
              );
            }

            unitPrice = tier.price;

            /*
             * IMPORTANT:
             * Set price is PER SET.
             */
            stockConsumption =
              item.quantity * setData.setSize;

            lineSnapshot.wholesaleUnit = "SET";
            lineSnapshot.piecesPerSet = setData.setSize;
            lineSnapshot.setName =
              setData.setName || undefined;
            lineSnapshot.setBreakAllowed =
              setData.setBreakAllowed;
            lineSnapshot.setComposition =
              setData.composition;
          }
        }

        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
          throw new Error(
            `${product.name}: invalid server price configuration.`
          );
        }

        /*
         * Aggregate inventory consumption across all lines.
         */
        requiredPieces.set(
          product.id,
          (requiredPieces.get(product.id) || 0) +
            stockConsumption
        );
        if (selectedVariant) {
          const variantStockKey = `${product.id}::${stringValue(selectedVariant.id)}`;
          requiredVariantStock.set(
            variantStockKey,
            (requiredVariantStock.get(variantStockKey) || 0) + stockConsumption
          );
        }

        const lineSubtotal =
          unitPrice * item.quantity;

        const orderItem: OrderLineItem = {
          productId: product.id,
          sellerId: product.sellerId,
          sellerName:
            product.sellerName || "ANJIVO Seller",
          productName: product.name,
          productSlug: product.slug || "",
          image:
            (selectedVariant && Array.isArray(selectedVariant.images)
              ? selectedVariant.images.find((image) => typeof image === "string")
              : undefined) || product.images[0] || "",
          quantity: item.quantity,
          pricingType: effectivePricingType,
          mrp: product.mrp,
          unitPrice,
          subtotal: lineSubtotal,
          moq,
          ...lineSnapshot,
          ...(selectedVariant
            ? {
                variantId: stringValue(selectedVariant.id),
                variantSku: stringValue(selectedVariant.sku),
                variantName: stringValue(selectedVariant.name),
                ...(stringValue(selectedVariant.size) ? { selectedSize: stringValue(selectedVariant.size) } : {}),
                ...(stringValue(selectedVariant.color) ? { selectedColor: stringValue(selectedVariant.color) } : {}),
                ...(stringValue(selectedVariant.value) ? { selectedVariantValue: stringValue(selectedVariant.value) } : {}),
              }
            : {}),
        };

        orderItems.push(orderItem);
        subtotal += lineSubtotal;

        const existingSeller = sellerMap.get(
          product.sellerId
        );

        if (existingSeller) {
          existingSeller.items.push(orderItem);
          existingSeller.subtotal += lineSubtotal;
        } else {
          sellerMap.set(product.sellerId, {
            sellerId: product.sellerId,
            sellerName:
              product.sellerName || "ANJIVO Seller",
            items: [orderItem],
            subtotal: lineSubtotal,
          });
        }
      }

      /*
       * ----------------------------------------------------------
       * FINAL AGGREGATED STOCK CHECK
       * ----------------------------------------------------------
       */
      for (const [
        productId,
        required,
      ] of requiredPieces) {
        const product = products.get(productId);

        if (!product) {
          throw new Error("Product not found.");
        }

        if (required > product.stock) {
          throw new Error(
            `${product.name}: insufficient stock. Available ${product.stock} pieces, required ${required} pieces.`
          );
        }
      }

      // Variant inventory is checked separately as well as product aggregate stock.
      for (const [variantStockKey, required] of requiredVariantStock) {
        const separatorIndex = variantStockKey.indexOf("::");
        const productId = variantStockKey.slice(0, separatorIndex);
        const variantId = variantStockKey.slice(separatorIndex + 2);
        const product = products.get(productId);
        const variant = product?.variantConfiguration?.variants?.find(
          (candidate) => stringValue(candidate.id) === variantId
        );
        if (!product || !variant || required > Math.max(0, Math.floor(numberValue(variant.stock)))) {
          throw new Error(`${product?.name || "Product"}: insufficient stock for selected variant.`);
        }
      }

      /*
       * ----------------------------------------------------------
       * COMMERCE TOTALS
       * ----------------------------------------------------------
       */
      const shippingCharge = 0;
      // Manual COD orders do not receive the online-prepaid discount.
      const discount = 0;
      const tax = 0;

      const total = Math.max(
        0,
        subtotal +
          shippingCharge +
          tax -
          discount
      );

      const sellerGroups = Array.from(
        sellerMap.values()
      );

      /*
       * ----------------------------------------------------------
       * CREATE PARENT ORDER
       * ----------------------------------------------------------
       */
      const orderRef = adminDb
        .collection("orders")
        .doc();

      const orderId = orderRef.id;

      transaction.set(orderRef, {
        id: orderId,
        userId: null,
        customerId: null,
        customerName,
        customerEmail,
        customerType: "GUEST",
        orderSource: "ADMIN",
        createdBy: adminUid,
        createdByRole: "ADMIN",

        shippingAddress,
        items: orderItems,
        sellerIds: sellerGroups.map((seller) => seller.sellerId),
        sellerCount: sellerGroups.length,

        subtotal,
        shippingCharge,
        discount,
        tax,
        total,
        totalAmount: total,
        currency: "INR",

        paymentMethod: "COD",
        paymentStatus: "PENDING",
        orderStatus: "PLACED",
        fulfillmentStatus: "PENDING",
        status: "pending",

        pricingTypes: Array.from(new Set(orderItems.map((item) => item.pricingType))),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      /*
       * ----------------------------------------------------------
       * CREATE SELLER ORDERS
       * ----------------------------------------------------------
       */
      for (const seller of sellerGroups) {
        const sellerOrderRef = adminDb
          .collection("sellerOrders")
          .doc();

        transaction.set(sellerOrderRef, {
          id: sellerOrderRef.id,
          orderId,

          sellerId: seller.sellerId,
          sellerName: seller.sellerName,

          customerId: null,
          customerName,
          customerEmail,
          customerType: "GUEST",
          orderSource: "ADMIN",
          createdBy: adminUid,

          items: seller.items,

          subtotal: seller.subtotal,
          shippingCharge: 0,
          discount: 0,
          tax: 0,
          total: seller.subtotal,

          paymentStatus: "PENDING",
          paymentMethod: "COD",
          orderStatus: "PLACED",
          fulfillmentStatus: "PENDING",

          createdAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        });
      }

      /*
       * ----------------------------------------------------------
       * DEDUCT INVENTORY
       * ----------------------------------------------------------
       *
       * For SET:
       * quantity × piecesPerSet is deducted.
       */
      for (const [
        productId,
        required,
      ] of requiredPieces) {
        const product = products.get(productId);
        const productRef = productRefs.get(productId);

        if (!product || !productRef) {
          throw new Error(
            "Product not found during inventory update."
          );
        }

        const newStock = product.stock - required;
        const variantConfiguration = product.variantConfiguration;
        const variants = variantConfiguration?.variants;

        if (Array.isArray(variants) && variants.length > 0) {
          const updatedVariants = variants.map((variant) => {
            const variantId = stringValue(variant.id);
            const consumed = requiredVariantStock.get(`${productId}::${variantId}`) || 0;
            if (consumed <= 0) return variant;
            const variantStock = Math.max(0, Math.floor(numberValue(variant.stock)));
            const nextVariantStock = variantStock - consumed;
            return {
              ...variant,
              stock: nextVariantStock,
              status: nextVariantStock <= 0 ? "out_of_stock" : "active",
            };
          });
          transaction.update(productRef, {
            stock: newStock,
            status: newStock <= 0 ? "out_of_stock" : "active",
            "variantConfiguration.variants": updatedVariants,
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          transaction.update(productRef, {
            stock: newStock,
            status: newStock <= 0 ? "out_of_stock" : "active",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      /*
       * ----------------------------------------------------------
       * TRANSACTION RECORD
       * ----------------------------------------------------------
       */
      const transactionRef = adminDb
        .collection("transactions")
        .doc();

      transaction.set(transactionRef, {
        id: transactionRef.id,
        orderId,
        userId: null,
        customerId: null,
        customerName,
        customerEmail,
        orderSource: "ADMIN",
        createdBy: adminUid,

        type: "ORDER_CREATED",

        paymentMethod: "COD",
        paymentStatus: "PENDING",

        amount: total,
        currency: "INR",

        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      });

      /*
       * ----------------------------------------------------------
       * AUDIT LOG
       * ----------------------------------------------------------
       */
      const auditRef = adminDb
        .collection("auditLogs")
        .doc();

      transaction.set(auditRef, {
        id: auditRef.id,

        action: "ORDER_CREATED",
        actionType: "CREATE",
        category: "ORDER",

        description:
          "Guest order manually created by an ANJIVO admin.",

        actorId: adminUid,
        actorRole: "ADMIN",

        targetId: orderId,
        targetType: "ORDER",
        orderId,

        metadata: {
          paymentMethod,
          sellerCount: sellerGroups.length,
          itemCount: orderItems.length,
          total,
        },

        createdAt:
          FieldValue.serverTimestamp(),
      });

      return {
        orderId,
        subtotal,
        shippingCharge,
        discount,
        tax,
        total,
        sellerCount: sellerGroups.length,
        itemCount: orderItems.length,
        alreadyCreated: false,
      };
    });

    return NextResponse.json(
      {
        success: true,
        message: "Manual guest order created successfully.",
        ...result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order creation error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create order.";

    const lowerMessage =
      message.toLowerCase();

    const isAuthError =
      lowerMessage.includes("authentication") ||
      lowerMessage.includes("token") ||
      lowerMessage.includes("unauthorized") ||
      lowerMessage.includes("admin access");

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: message === "Admin access required." ? 403 : isAuthError ? 401 : 400,
      }
    );
  }
}
